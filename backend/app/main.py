from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import random  # <-- ADDED
import os
import httpx
from .pose_engine import MoveNetEngine
from .reference_pose import REFERENCE_SQUAT, compute_pose_similarity
from .database import get_db
from .models import User, UserProfile, DietPlan, ProgressLog, ChatLog, Gym, Trainer, WorkoutSession, CompletedChallenge
from .auth import create_access_token, get_current_user
from .chat_llama import get_chat_response

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

pose_engine = MoveNetEngine()

# ---------- Auth ----------
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email already registered")
    new_user = User(name=data.name, email=data.email, password=data.password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}

@app.post("/api/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or user.password != data.password:
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/user/me")
def get_me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    return {"id": user.id, "name": user.name, "email": user.email}

# ---------- Pose ----------
@app.post("/api/pose/compare")
async def compare_pose(file: UploadFile = File(...)):
    image_bytes = await file.read()
    user_norm = pose_engine.get_normalized_keypoints(image_bytes)
    if user_norm is None:
        return {"similarity": 0, "feedback": "❌ No person detected"}
    similarity, _ = compute_pose_similarity(user_norm, REFERENCE_SQUAT["keypoints"])
    feedback = f"Match: {similarity:.1f}%" + (" – Perfect!" if similarity > 85 else " – Keep adjusting.")
    return {"similarity": round(similarity,1), "feedback": feedback, "user_keypoints": user_norm}

# ---------- Profile ----------
class ProfileData(BaseModel):
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    fitness_goal: str
    activity_level: str
    dietary_restrictions: Optional[List[str]] = []

@app.get("/api/profile/")
def get_profile(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user["user_id"]).first()
    if not profile:
        raise HTTPException(404, "Profile not set up")
    return profile

@app.post("/api/profile/setup")
def setup_profile(data: ProfileData, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    existing = db.query(UserProfile).filter(UserProfile.user_id == current_user["user_id"]).first()
    if existing:
        raise HTTPException(400, "Profile already exists. Use PUT to update.")
    bmi = data.weight_kg / ((data.height_cm/100)**2) if data.height_cm else 0
    new_profile = UserProfile(
        user_id=current_user["user_id"],
        age=data.age, gender=data.gender,
        height_cm=data.height_cm, weight_kg=data.weight_kg,
        bmi=round(bmi,1),
        fitness_goal=data.fitness_goal,
        activity_level=data.activity_level,
        dietary_restrictions=data.dietary_restrictions
    )
    db.add(new_profile)
    db.commit()
    return {"message": "Profile saved"}

@app.put("/api/profile/update")
def update_profile(data: ProfileData, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user["user_id"]).first()
    if not profile:
        raise HTTPException(404, "Profile not found")
    bmi = data.weight_kg / ((data.height_cm/100)**2) if data.height_cm else 0
    profile.age = data.age
    profile.gender = data.gender
    profile.height_cm = data.height_cm
    profile.weight_kg = data.weight_kg
    profile.bmi = round(bmi,1)
    profile.fitness_goal = data.fitness_goal
    profile.activity_level = data.activity_level
    profile.dietary_restrictions = data.dietary_restrictions
    db.commit()
    return {"message": "Profile updated"}

# ---------- Chat ----------
class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = ""

@app.post("/api/chat/")
def chat(req: ChatRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user["user_id"]).first()
    user_context = ""
    if profile:
        user_context = f"The user is {profile.age} years old, goal: {profile.fitness_goal}. "
    full_context = user_context + req.context
    try:
        reply = get_chat_response(req.message, full_context)
    except Exception as e:
        reply = f"AI Coach temporary error: {str(e)}"
    chat_log = ChatLog(
        user_id=current_user["user_id"],
        user_msg=req.message,
        bot_reply=reply
    )
    db.add(chat_log)
    db.commit()
    return {"reply": reply}

@app.get("/api/chat/history")
def get_chat_history(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user), limit: int = 100):
    logs = db.query(ChatLog).filter(
        ChatLog.user_id == current_user["user_id"]
    ).order_by(ChatLog.created_at.asc()).limit(limit).all()
    history = []
    for log in logs:
        history.append({"role": "user", "content": log.user_msg})
        history.append({"role": "bot", "content": log.bot_reply})
    return history

# ---------- Diet (random meals from 100+ line text files) ----------
class DietRequest(BaseModel):
    duration: int
    goal: str

def ensure_diet_files():
    """Create diet_data folder and default files ONLY if missing (does NOT overwrite existing)."""
    data_dir = os.path.join(os.path.dirname(__file__), "diet_data")
    os.makedirs(data_dir, exist_ok=True)
    
    default_meals = {
        "lose.txt": [
            "Scrambled eggs with spinach", "Greek yogurt with berries", "Oatmeal with almond milk", "Cottage cheese with fruit",
            "Grilled chicken salad", "Quinoa bowl with chickpeas", "Turkey wrap with lettuce", "Baked salmon with broccoli",
            "Zucchini noodles with meatballs", "Lean beef stir-fry", "Baked cod with asparagus", "Vegetable curry"
        ],
        "gain.txt": [
            "Oatmeal with protein powder", "Eggs and whole grain toast", "Greek yogurt with granola", "Protein pancakes",
            "Chicken breast with brown rice", "Beef bowl with quinoa", "Tuna sandwich on whole grain", "Salmon with sweet potato",
            "Steak with roasted potatoes", "Chicken thighs with rice", "Ground turkey chili", "Pasta with meat sauce"
        ],
        "maintain.txt": [
            "Oatmeal with berries", "Scrambled eggs on toast", "Smoothie bowl", "Greek yogurt with honey",
            "Grilled chicken wrap", "Quinoa salad with feta", "Turkey sandwich", "Lentil soup",
            "Salmon with quinoa", "Chicken stir-fry", "Beef stew with vegetables", "Vegetable curry"
        ]
    }
    
    for filename, meals in default_meals.items():
        file_path = os.path.join(data_dir, filename)
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("\n".join(meals))

def load_all_meals(file_path):
    """Load all non-empty lines from a text file (supports 100+ lines)."""
    with open(file_path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

@app.post("/api/diet/generate")
def generate_diet_plan(req: DietRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user["user_id"]).first()
    if not profile:
        raise HTTPException(400, "Please complete your profile first.")
    
    # Ensure diet files exist (does not overwrite existing)
    ensure_diet_files()
    
    # Map goal to filename
    goal_file = {
        "weight_loss": "lose.txt",
        "muscle_gain": "gain.txt",
        "maintenance": "maintain.txt"
    }.get(req.goal)
    if not goal_file:
        raise HTTPException(400, "Invalid goal")
    
    file_path = os.path.join(os.path.dirname(__file__), "diet_data", goal_file)
    try:
        all_meals = load_all_meals(file_path)
    except Exception as e:
        raise HTTPException(500, f"Failed to read diet file: {str(e)}")
    
    if len(all_meals) < 3:
        raise HTTPException(500, f"Not enough meals in {goal_file}. Need at least 3.")
    
    # Calculate calorie target
    if profile.gender == "male":
        bmr = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age + 5
    else:
        bmr = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age - 161
    activity_map = {"sedentary":1.2, "light":1.375, "moderate":1.55, "active":1.725}
    tdee = bmr * activity_map.get(profile.activity_level, 1.2)
    goal_adjust = {"weight_loss": -500, "muscle_gain": 300, "maintenance": 0}
    target_calories = max(1500, tdee + goal_adjust.get(req.goal, 0))
    
    # Macros (approximate)
    protein_g = round((target_calories * 0.30) / 4)
    carbs_g = round((target_calories * 0.40) / 4)
    fat_g = round((target_calories * 0.30) / 9)
    
    # Generate plan: for each day, randomly pick 3 distinct meals (breakfast, lunch, dinner)
    plan = {}
    for day in range(1, req.duration + 1):
        # Randomly sample 3 distinct meals
        day_meals = random.sample(all_meals, 3)
        plan[f"day{day}"] = {
            "breakfast": day_meals[0],
            "lunch": day_meals[1],
            "dinner": day_meals[2]
        }
    
    goal_name = {"weight_loss": "Weight Loss", "muscle_gain": "Muscle Gain", "maintenance": "Maintenance"}[req.goal]
    return {
        "calories": target_calories,
        "macros": {"protein_g": protein_g, "carbs_g": carbs_g, "fat_g": fat_g},
        "plan": plan,
        "goal": goal_name,
        "message": f"{goal_name} plan – Daily target: {target_calories} calories"
    }

# ---------- Progress ----------
@app.get("/api/progress/latest")
def get_latest_progress(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    last = db.query(ProgressLog).filter(ProgressLog.user_id == current_user["user_id"]).order_by(ProgressLog.logged_at.desc()).first()
    if last:
        return {"accuracy": 78, "weight_kg": last.weight_kg, "date": last.logged_at.strftime("%Y-%m-%d")}
    return {"accuracy": 0, "weight_kg": 0, "date": ""}

@app.get("/api/progress/")
def get_all_progress(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logs = db.query(ProgressLog).filter(ProgressLog.user_id == current_user["user_id"]).order_by(ProgressLog.logged_at.desc()).all()
    return [{"id": log.id, "logged_at": log.logged_at, "weight_kg": log.weight_kg, "notes": log.notes} for log in logs]

@app.post("/api/progress/log")
async def log_progress(weight_kg: float = Form(...), notes: str = Form(""), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    log = ProgressLog(user_id=current_user["user_id"], weight_kg=weight_kg, notes=notes)
    db.add(log)
    db.commit()
    return {"message": "Progress logged", "weight_kg": weight_kg, "notes": notes}

# ---------- Workout Sessions ----------
class SaveWorkoutRequest(BaseModel):
    exercise: str
    rep_count: int
    avg_accuracy: float

@app.post("/api/workout/save")
def save_workout_session(data: SaveWorkoutRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    session = WorkoutSession(user_id=current_user["user_id"], exercise=data.exercise, rep_count=data.rep_count, avg_accuracy=data.avg_accuracy)
    db.add(session)
    db.commit()
    return {"message": "Workout saved"}

@app.get("/api/workout/today")
def get_today_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    sessions = db.query(WorkoutSession).filter(WorkoutSession.user_id == current_user["user_id"], WorkoutSession.created_at >= today_start).all()
    total_reps = sum(s.rep_count for s in sessions)
    avg_acc = sum(s.avg_accuracy for s in sessions) / len(sessions) if sessions else 0
    return {"total_reps": total_reps, "avg_accuracy": round(avg_acc, 1)}

@app.get("/api/workout/yesterday")
def get_yesterday_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    today = datetime.now().date()
    yesterday_start = datetime.combine(today - timedelta(days=1), datetime.min.time())
    yesterday_end = datetime.combine(today, datetime.min.time())
    sessions = db.query(WorkoutSession).filter(
        WorkoutSession.user_id == current_user["user_id"],
        WorkoutSession.created_at >= yesterday_start,
        WorkoutSession.created_at < yesterday_end
    ).all()
    total_reps = sum(s.rep_count for s in sessions)
    avg_acc = sum(s.avg_accuracy for s in sessions) / len(sessions) if sessions else 0
    return {"total_reps": total_reps, "avg_accuracy": round(avg_acc, 1)}

@app.get("/api/workout/recent")
def get_recent_sessions(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user), limit: int = 5):
    sessions = db.query(WorkoutSession).filter(WorkoutSession.user_id == current_user["user_id"]).order_by(WorkoutSession.created_at.desc()).limit(limit).all()
    return [{"id": s.id, "exercise": s.exercise, "rep_count": s.rep_count, "avg_accuracy": s.avg_accuracy, "date": s.created_at.strftime("%Y-%m-%d %H:%M")} for s in sessions]

# ---------- Gyms ----------
@app.get("/api/gyms/")
def list_gyms():
    return [{"id": 1, "name": "Fitness First", "location": "Downtown", "contact": "555-1234", "verified": True},
            {"id": 2, "name": "Gold's Gym", "location": "Uptown", "contact": "555-5678", "verified": False}]

@app.get("/api/gyms/trainers")
def list_trainers():
    return [{"id": 1, "name": "John Smith", "speciality": "Strength Training", "gym_id": 1},
            {"id": 2, "name": "Jane Doe", "speciality": "Yoga", "gym_id": 2}]

@app.get("/api/gyms/nearby")
async def get_nearby_gyms(lat: float, lng: float, radius: int = 10000):
    dummy_gyms = [
        {"id": 1, "name": "Fitness First (Demo)", "lat": lat + 0.012, "lng": lng + 0.008, "address": "Main Street", "phone": "+1 555-1234"},
        {"id": 2, "name": "Gold's Gym (Demo)", "lat": lat - 0.01, "lng": lng - 0.006, "address": "Second Avenue", "phone": "+1 555-5678"},
        {"id": 3, "name": "Anytime Fitness (Demo)", "lat": lat + 0.005, "lng": lng - 0.012, "address": "Market Square", "phone": "+1 555-9012"},
    ]
    bizdata_url = "https://bizdata-web.vercel.app/api/businesses"
    params = {
        "latitude": lat,
        "longitude": lng,
        "category": "gym",
        "radius_km": radius / 1000,
        "limit": 20
    }
    headers = {"User-Agent": "AI-Fitness-Model/1.0 (educational project)"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(bizdata_url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
        gyms = []
        for biz in data.get("businesses", []):
            name = biz.get("name")
            if not name or not biz.get("latitude") or not biz.get("longitude"):
                continue
            gyms.append({
                "id": biz.get("id", str(hash(name))),
                "name": name,
                "lat": biz.get("latitude"),
                "lng": biz.get("longitude"),
                "address": biz.get("address", ""),
                "phone": biz.get("phone", ""),
            })
        if gyms:
            return {"results": gyms, "count": len(gyms), "is_demo": False}
        else:
            return {"results": dummy_gyms, "count": len(dummy_gyms), "is_demo": True, "note": "No real gyms found – showing sample data"}
    except Exception as e:
        print(f"BizData API error: {e}")
        return {"results": dummy_gyms, "count": len(dummy_gyms), "is_demo": True, "note": "API error – showing sample data"}

@app.get("/api/geocode")
async def geocode_address(address: str):
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": address, "format": "json", "limit": 1}
    headers = {"User-Agent": "AI-Fitness-Model/1.0 (educational project)"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
        if data:
            return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
        else:
            raise HTTPException(404, "Address not found")
    except Exception as e:
        print(f"Geocoding error: {e}")
        raise HTTPException(500, f"Geocoding failed: {str(e)}")

# ---------- Challenges ----------
class CompleteChallengeRequest(BaseModel):
    challenge_id: int

@app.post("/api/challenges/complete")
def complete_challenge(data: CompleteChallengeRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    existing = db.query(CompletedChallenge).filter(
        CompletedChallenge.user_id == current_user["user_id"],
        CompletedChallenge.challenge_id == data.challenge_id,
        CompletedChallenge.completed_at > one_hour_ago
    ).first()
    if existing:
        raise HTTPException(400, "Challenge already completed in the last hour")
    new = CompletedChallenge(user_id=current_user["user_id"], challenge_id=data.challenge_id)
    db.add(new)
    db.commit()
    return {"message": "Challenge marked as complete"}

@app.get("/api/challenges/completed")
def get_completed_challenges(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    completed = db.query(CompletedChallenge).filter(
        CompletedChallenge.user_id == current_user["user_id"],
        CompletedChallenge.completed_at > one_hour_ago
    ).all()
    return [{"challenge_id": c.challenge_id, "completed_at": c.completed_at.isoformat()} for c in completed]

# ---------- Root ----------
@app.get("/")
def root():
    return {"message": "AI Fitness Model API running with full features"}
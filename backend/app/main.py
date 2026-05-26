from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import random
import os
import httpx
import json
import shutil
import smtplib
import math
from email.message import EmailMessage
from .pose_engine import MoveNetEngine
from .reference_pose import REFERENCE_SQUAT, compute_pose_similarity
from .database import get_db
from .models import User, UserProfile, DietPlan, ProgressLog, ChatLog, Gym, Trainer, WorkoutSession, CompletedChallenge, TrainerBooking, WorkoutPlan
from .auth import create_access_token, get_current_user
from .chat_groq import get_chat_response
from pathlib import Path
import time
import cloudinary
import cloudinary.uploader
import cloudinary.api

# ---------- Redis (optional) ----------
try:
    import redis
    redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
    redis_client.ping()
    REDIS_AVAILABLE = True
except:
    REDIS_AVAILABLE = False
    redis_client = None
    print("Redis not available – caching disabled")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# ---------- Cloudinary Configuration ----------
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ai-fitness-model-9mlw.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pose_engine = MoveNetEngine()

# ---------- Pydantic Request Models ----------
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ProfileData(BaseModel):
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    fitness_goal: str
    activity_level: str
    dietary_restrictions: Optional[List[str]] = []

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = ""

class DietRequest(BaseModel):
    duration: int
    goal: str

class SaveWorkoutRequest(BaseModel):
    exercise: str
    rep_count: int
    avg_accuracy: float

class CompleteChallengeRequest(BaseModel):
    challenge_id: int

class WorkoutPlanRequest(BaseModel):
    duration: int = 7
    focus: str = "full_body"

class BookingRequest(BaseModel):
    trainer_id: int
    trainer_name: str
    booking_date: str

class WhatsAppReminderRequest(BaseModel):
    reminder_type: str
    phone_number: str

# ---------- Pydantic Response Schemas (for OpenAPI) ----------
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    class Config:
        from_attributes = True

class UserProfileResponse(BaseModel):
    id: int
    user_id: int
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    bmi: float
    fitness_goal: str
    activity_level: str
    dietary_restrictions: Optional[List[str]] = []
    class Config:
        from_attributes = True

class ProgressLogResponse(BaseModel):
    id: int
    logged_at: datetime
    weight_kg: Optional[float]
    notes: Optional[str]
    photo_url: Optional[str]
    class Config:
        from_attributes = True

class WorkoutSessionResponse(BaseModel):
    id: int
    exercise: str
    rep_count: int
    avg_accuracy: Optional[float]
    date: str
    class Config:
        from_attributes = True

# ---------- Helper: Diet files ----------
def ensure_diet_files():
    data_dir = os.path.join(os.path.dirname(__file__), "diet_data")
    os.makedirs(data_dir, exist_ok=True)
    default_meals = {
        "lose.txt": ["Scrambled eggs with spinach", "Greek yogurt with berries", "Oatmeal with almond milk", "Cottage cheese with fruit", "Grilled chicken salad", "Quinoa bowl with chickpeas", "Turkey wrap with lettuce", "Baked salmon with broccoli", "Zucchini noodles with meatballs", "Lean beef stir-fry", "Baked cod with asparagus", "Vegetable curry"],
        "gain.txt": ["Oatmeal with protein powder", "Eggs and whole grain toast", "Greek yogurt with granola", "Protein pancakes", "Chicken breast with brown rice", "Beef bowl with quinoa", "Tuna sandwich on whole grain", "Salmon with sweet potato", "Steak with roasted potatoes", "Chicken thighs with rice", "Ground turkey chili", "Pasta with meat sauce"],
        "maintain.txt": ["Oatmeal with berries", "Scrambled eggs on toast", "Smoothie bowl", "Greek yogurt with honey", "Grilled chicken wrap", "Quinoa salad with feta", "Turkey sandwich", "Lentil soup", "Salmon with quinoa", "Chicken stir-fry", "Beef stew with vegetables", "Vegetable curry"]
    }
    for filename, meals in default_meals.items():
        file_path = os.path.join(data_dir, filename)
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("\n".join(meals))

def load_all_meals(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

# ---------- Load from text files ----------
def load_workout_plans():
    plans = []
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_dir, "workout_plans.txt")
    print(f"Looking for workout_plans.txt at: {file_path}")
    print(f"File exists: {os.path.exists(file_path)}")
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if line:
                    try:
                        plans.append(json.loads(line))
                    except Exception as e:
                        print(f"Error parsing line {line_num}: {e}")
    if not plans:
        print("Using fallback plan")
        plans = [{"focus":"full_body","days":[{"day":1,"exercises":["Squats 3x12","Push-ups 3x10"]},{"day":2,"exercises":["Rest"]},{"day":3,"exercises":["Lunges 3x12"]}]}]
    print(f"Total workout plans loaded: {len(plans)}")
    return plans

def load_trainers():
    trainers = []
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_dir, "trainers.txt")
    print(f"Looking for trainers.txt at: {file_path}")
    print(f"File exists: {os.path.exists(file_path)}")
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if line:
                    try:
                        trainers.append(json.loads(line))
                    except Exception as e:
                        print(f"Error parsing trainer line {line_num}: {e}")
    if not trainers:
        print("Using fallback trainer")
        trainers = [{"id":1,"name":"John Smith","speciality":"Strength","hourly_rate":50,"experience":"5 years","bio":"Trainer"}]
    print(f"Total trainers loaded: {len(trainers)}")
    return trainers

WORKOUT_PLANS = load_workout_plans()
ALL_TRAINERS = load_trainers()
_last_trainer_time = 0
_cached_trainers = []

# ---------- Workout templates (fallback) ----------
WORKOUT_TEMPLATES = {
    "weight_loss": {
        "full_body": [
            {"day": 1, "exercises": ["Jumping Jacks (3x30s)", "Bodyweight Squats (3x15)", "Push-ups (3x10)", "Plank (3x30s)", "Lunges (3x12 each)"]},
            {"day": 2, "exercises": ["Rest or 30 min brisk walk"]},
            {"day": 3, "exercises": ["Burpees (3x10)", "Mountain Climbers (3x20)", "Squat Jumps (3x12)", "Bicycle Crunches (3x20)", "High Knees (3x30s)"]},
            {"day": 4, "exercises": ["Rest or light stretching"]},
            {"day": 5, "exercises": ["Walking Lunges (3x12 each)", "Incline Push-ups (3x12)", "Glute Bridges (3x15)", "Russian Twists (3x20)", "Jump Rope (3x1 min)"]},
        ]
    },
    "muscle_gain": {
        "full_body": [
            {"day": 1, "exercises": ["Goblet Squats (4x10)", "Push-ups (4x12)", "Pull-ups (or Rows) (4x8)", "Overhead Press (4x10)", "Leg Raises (4x15)"]},
            {"day": 2, "exercises": ["Rest (active recovery)"]},
            {"day": 3, "exercises": ["Lunges (4x12 each)", "Dips (4x10)", "Bent-over Rows (4x10)", "Bicep Curls (4x12)", "Calf Raises (4x20)"]},
            {"day": 4, "exercises": ["Rest"]},
            {"day": 5, "exercises": ["Deadlifts (or Kettlebell Swings) (4x8)", "Bench Press (4x10)", "Pull-ups (4x6)", "Plank (4x45s)", "Squats (4x12)"]},
        ]
    },
    "maintenance": {
        "full_body": [
            {"day": 1, "exercises": ["Squats (3x12)", "Push-ups (3x12)", "Rows (3x12)", "Plank (3x30s)"]},
            {"day": 2, "exercises": ["Rest or 20 min walk"]},
            {"day": 3, "exercises": ["Lunges (3x12 each)", "Dips (3x12)", "Leg Raises (3x15)", "Glute Bridges (3x15)"]},
            {"day": 4, "exercises": ["Rest"]},
            {"day": 5, "exercises": ["Full body circuit: Squats, Push-ups, Lunges, Plank (3 rounds)"]},
        ]
    }
}

VIDEO_LIBRARY = {
    "squat": "https://www.youtube.com/watch?v=aclHkVaku9U",
    "pushup": "https://www.youtube.com/watch?v=IODxDxX7oi4",
    "lunge": "https://www.youtube.com/watch?v=QOVaHwm-Q6U",
    "curl": "https://www.youtube.com/watch?v=ykJmrZ5v0Oo",
    "plank": "https://www.youtube.com/watch?v=pSHjTRCQxIw",
    "deadlift": "https://www.youtube.com/watch?v=1ZXobu7JcNE",
    "pullup": "https://www.youtube.com/watch?v=eGo4IYlbE5g",
}

SUPPLEMENTS = {
    "weight_loss": ["Whey Protein Isolate (low carb)", "Green Tea Extract", "CLA", "Fiber Supplements (Psyllium Husk)"],
    "muscle_gain": ["Whey Protein Concentrate", "Creatine Monohydrate", "BCAA", "Mass Gainer (if needed)"],
    "maintenance": ["Plant Protein (Pea/Rice)", "Omega-3 Fish Oil", "Multivitamin", "Probiotics"]
}

# ---------- Email config (only one, using your credentials) ----------
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "ahsan.netflix05@gmail.com"
SMTP_PASS = "Aliahsan2005"   # Replace with App Password if needed
EMAIL_CONFIGURED = SMTP_USER != "your_email@gmail.com" and SMTP_PASS != "your_app_password"

def send_email(to_email: str, subject: str, body: str):
    if not EMAIL_CONFIGURED:
        print(f"Email not configured. Would send to {to_email}: {subject}")
        return
    try:
        msg = EmailMessage()
        msg.set_content(body)
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = to_email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Email failed: {e}")

# ---------- Auth Endpoints (with response models) ----------
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

@app.get("/api/user/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user

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
@app.get("/api/profile/", response_model=UserProfileResponse)
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
    logs = db.query(ChatLog).filter(ChatLog.user_id == current_user["user_id"]).order_by(ChatLog.created_at.asc()).limit(limit).all()
    history = []
    for log in logs:
        history.append({"role": "user", "content": log.user_msg})
        history.append({"role": "bot", "content": log.bot_reply})
    return history

# ---------- Diet ----------
@app.post("/api/diet/generate")
def generate_diet_plan(req: DietRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cache_key = f"diet:{current_user['user_id']}:{req.goal}:{req.duration}"
    if REDIS_AVAILABLE:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user["user_id"]).first()
    if not profile:
        raise HTTPException(400, "Please complete your profile first.")
    
    ensure_diet_files()
    goal_file = {"weight_loss": "lose.txt", "muscle_gain": "gain.txt", "maintenance": "maintain.txt"}.get(req.goal)
    if not goal_file:
        raise HTTPException(400, "Invalid goal")
    file_path = os.path.join(os.path.dirname(__file__), "diet_data", goal_file)
    try:
        all_meals = load_all_meals(file_path)
    except Exception as e:
        raise HTTPException(500, f"Failed to read diet file: {str(e)}")
    if len(all_meals) < 3:
        raise HTTPException(500, f"Not enough meals in {goal_file}. Need at least 3.")
    
    if profile.gender == "male":
        bmr = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age + 5
    else:
        bmr = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age - 161
    activity_map = {"sedentary":1.2, "light":1.375, "moderate":1.55, "active":1.725}
    tdee = bmr * activity_map.get(profile.activity_level, 1.2)
    goal_adjust = {"weight_loss": -500, "muscle_gain": 300, "maintenance": 0}
    target_calories = max(1500, tdee + goal_adjust.get(req.goal, 0))
    
    protein_g = round((target_calories * 0.30) / 4)
    carbs_g = round((target_calories * 0.40) / 4)
    fat_g = round((target_calories * 0.30) / 9)
    
    plan = {}
    for day in range(1, req.duration + 1):
        day_meals = random.sample(all_meals, 3)
        plan[f"day{day}"] = {"breakfast": day_meals[0], "lunch": day_meals[1], "dinner": day_meals[2]}
    
    goal_name = {"weight_loss": "Weight Loss", "muscle_gain": "Muscle Gain", "maintenance": "Maintenance"}[req.goal]
    response_data = {
        "calories": target_calories,
        "macros": {"protein_g": protein_g, "carbs_g": carbs_g, "fat_g": fat_g},
        "plan": plan,
        "goal": goal_name,
        "message": f"{goal_name} plan – Daily target: {target_calories} calories"
    }
    if REDIS_AVAILABLE:
        redis_client.setex(cache_key, 3600, json.dumps(response_data))
    return response_data

# ---------- Progress ----------
UPLOAD_DIR = "user_photos"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/progress/photo")
async def upload_progress_photo(photo: UploadFile = File(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        contents = await photo.read()
        upload_result = cloudinary.uploader.upload(
            contents,
            folder=f"user_{current_user['user_id']}/progress",
            public_id=f"photo_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            overwrite=True
        )
        photo_url = upload_result['secure_url']
        new_log = ProgressLog(
            user_id=current_user["user_id"],
            weight_kg=None,
            photo_url=photo_url,
            notes="Progress photo uploaded"
        )
        db.add(new_log)
        db.commit()
        return {"message": "Photo uploaded successfully", "file_path": photo_url}
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(500, f"Upload failed: {str(e)}")

@app.post("/api/progress/before-after")
async def upload_before_after_photo(
    photo: UploadFile = File(...),
    photo_type: str = Form(...),
    notes: str = Form(""),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        contents = await photo.read()
        upload_result = cloudinary.uploader.upload(
            contents,
            folder=f"user_{current_user['user_id']}/before_after",
            public_id=f"{photo_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            overwrite=True
        )
        photo_url = upload_result['secure_url']
        new_log = ProgressLog(
            user_id=current_user["user_id"],
            weight_kg=None,
            photo_url=photo_url,
            notes=f"{photo_type} photo: {notes}" if notes else f"{photo_type} photo"
        )
        db.add(new_log)
        db.commit()
        return {"message": f"{photo_type.capitalize()} photo uploaded", "file_path": photo_url}
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(500, f"Upload failed: {str(e)}")

@app.get("/api/progress/latest-photo")
def get_latest_photo(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    latest = db.query(ProgressLog).filter(
        ProgressLog.user_id == current_user["user_id"],
        ProgressLog.photo_url.isnot(None)
    ).order_by(ProgressLog.logged_at.desc()).first()
    if latest:
        return {"photo_url": latest.photo_url, "logged_at": latest.logged_at.isoformat(), "id": latest.id}
    return {"photo_url": None, "id": None}

@app.get("/api/progress/", response_model=List[ProgressLogResponse])
def get_all_progress(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logs = db.query(ProgressLog).filter(ProgressLog.user_id == current_user["user_id"]).order_by(ProgressLog.logged_at.desc()).all()
    return logs

@app.post("/api/progress/log")
async def log_progress(weight_kg: float = Form(...), notes: str = Form(""), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    log = ProgressLog(user_id=current_user["user_id"], weight_kg=weight_kg, notes=notes)
    db.add(log)
    db.commit()
    return {"message": "Progress logged", "weight_kg": weight_kg, "notes": notes}

@app.get("/api/progress/latest")
def get_latest_progress(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    last = db.query(ProgressLog).filter(ProgressLog.user_id == current_user["user_id"]).order_by(ProgressLog.logged_at.desc()).first()
    if last:
        return {"accuracy": 78, "weight_kg": last.weight_kg, "date": last.logged_at.strftime("%Y-%m-%d")}
    return {"accuracy": 0, "weight_kg": 0, "date": ""}

# ---------- Delete Endpoints ----------
@app.delete("/api/progress/photo/{photo_id}")
def delete_progress_photo(photo_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    photo_log = db.query(ProgressLog).filter(ProgressLog.id == photo_id, ProgressLog.user_id == current_user["user_id"]).first()
    if not photo_log:
        raise HTTPException(404, "Photo not found")
    db.delete(photo_log)
    db.commit()
    return {"message": "Photo record deleted"}

@app.delete("/api/progress/before-after/{photo_type}")
def delete_before_after_photo(photo_type: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    photo_log = db.query(ProgressLog).filter(
        ProgressLog.user_id == current_user["user_id"],
        ProgressLog.photo_url.isnot(None),
        ProgressLog.notes.contains(photo_type)
    ).order_by(ProgressLog.logged_at.desc()).first()
    if not photo_log:
        raise HTTPException(404, f"No {photo_type} photo found")
    db.delete(photo_log)
    db.commit()
    return {"message": f"{photo_type} photo record deleted"}

# ---------- Workout Sessions ----------
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

@app.get("/api/workout/recent", response_model=List[WorkoutSessionResponse])
def get_recent_sessions(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user), limit: int = 5):
    sessions = db.query(WorkoutSession).filter(WorkoutSession.user_id == current_user["user_id"]).order_by(WorkoutSession.created_at.desc()).limit(limit).all()
    return [
        {
            "id": s.id,
            "exercise": s.exercise,
            "rep_count": s.rep_count,
            "avg_accuracy": s.avg_accuracy,
            "date": s.created_at.strftime("%Y-%m-%d %H:%M")
        } for s in sessions
    ]

# ---------- Workout Plan Generator ----------
@app.post("/api/workout/generate")
def generate_workout_plan(req: WorkoutPlanRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user["user_id"]).first()
    if not profile:
        raise HTTPException(400, "Complete your profile first")
    if not WORKOUT_PLANS:
        raise HTTPException(500, "No workout plans loaded. Check workout_plans.txt file.")
    template = random.choice(WORKOUT_PLANS)
    template_days = template.get("days", [])
    if not template_days:
        raise HTTPException(500, "Invalid plan template: no days found")
    final_plan = []
    for i in range(req.duration):
        day_index = i % len(template_days)
        day_data = template_days[day_index].copy()
        day_data["day"] = i + 1
        final_plan.append(day_data)
    return {
        "goal": profile.fitness_goal,
        "focus": template.get("focus", "full_body"),
        "duration_days": req.duration,
        "plan": final_plan,
        "tip": "Perform each exercise as specified. Rest 60s between sets."
    }

@app.get("/api/workout/saved-plans")
def get_saved_workout_plans(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    plans = db.query(WorkoutPlan).filter(WorkoutPlan.user_id == current_user["user_id"]).order_by(WorkoutPlan.created_at.desc()).all()
    return [{"id": p.id, "goal": p.goal, "duration": p.duration_days, "created_at": p.created_at.isoformat()} for p in plans]

# ---------- Workout Videos ----------
@app.get("/api/workout/videos")
def get_workout_videos(exercise: Optional[str] = None):
    if exercise and exercise.lower() in VIDEO_LIBRARY:
        return {"exercise": exercise, "url": VIDEO_LIBRARY[exercise.lower()]}
    return {"videos": VIDEO_LIBRARY}

# ---------- Supplement Recommendations ----------
@app.get("/api/supplements/recommend")
def recommend_supplements(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user["user_id"]).first()
    if not profile:
        raise HTTPException(400, "Complete your profile first")
    goal = profile.fitness_goal
    recs = SUPPLEMENTS.get(goal, SUPPLEMENTS["maintenance"])
    return {"goal": goal, "recommendations": recs, "note": "Consult a doctor before taking supplements."}

# ---------- Trainer Booking ----------
@app.get("/api/trainers/available")
def list_available_trainers():
    global _last_trainer_time, _cached_trainers
    now = time.time()
    if now - _last_trainer_time > 3600 or not _cached_trainers:
        if ALL_TRAINERS:
            shuffled = ALL_TRAINERS.copy()
            random.shuffle(shuffled)
            num = min(random.randint(10, 15), len(shuffled))
            _cached_trainers = shuffled[:num]
            _last_trainer_time = now
        else:
            _cached_trainers = []
    return _cached_trainers

# ---------- Email Reminders ----------
@app.post("/api/reminders/schedule")
def schedule_reminder(reminder_type: str, remind_at: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    background_tasks.add_task(
        send_email,
        user.email,
        f"Fitness Reminder: {reminder_type}",
        f"Hello {user.name},\n\nIt's time to {reminder_type}!\n\nStay consistent!\n- AI Fitness Coach"
    )
    return {"message": f"Reminder email scheduled to {user.email}"}

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
    params = {"latitude": lat, "longitude": lng, "category": "gym", "radius_km": radius / 1000, "limit": 20}
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
            gyms.append({"id": biz.get("id", str(hash(name))), "name": name, "lat": biz.get("latitude"), "lng": biz.get("longitude"), "address": biz.get("address", ""), "phone": biz.get("phone", "")})
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

# ---------- Body Comparison ----------
def get_body_measurements(image_bytes):
    keypoints = pose_engine.get_normalized_keypoints(image_bytes)
    if not keypoints or len(keypoints) < 33:
        return None
    left_shoulder = keypoints[11]
    right_shoulder = keypoints[12]
    left_hip = keypoints[23]
    right_hip = keypoints[24]
    shoulder_width = math.hypot(right_shoulder[0] - left_shoulder[0], right_shoulder[1] - left_shoulder[1])
    hip_width = math.hypot(right_hip[0] - left_hip[0], right_hip[1] - left_hip[1])
    torso_height = abs(left_shoulder[1] - left_hip[1])
    waist_width = (shoulder_width + hip_width) / 2
    waist_to_hip_ratio = waist_width / hip_width if hip_width > 0 else 1
    shoulder_to_waist_ratio = shoulder_width / waist_width if waist_width > 0 else 1
    return {
        "shoulder_width": shoulder_width,
        "hip_width": hip_width,
        "torso_height": torso_height,
        "waist_to_hip_ratio": waist_to_hip_ratio,
        "shoulder_to_waist_ratio": shoulder_to_waist_ratio,
    }

@app.get("/api/progress/compare")
async def compare_before_after(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    before_log = db.query(ProgressLog).filter(
        ProgressLog.user_id == current_user["user_id"],
        ProgressLog.notes.contains("before")
    ).order_by(ProgressLog.logged_at.asc()).first()
    after_log = db.query(ProgressLog).filter(
        ProgressLog.user_id == current_user["user_id"],
        ProgressLog.notes.contains("after")
    ).order_by(ProgressLog.logged_at.desc()).first()
    if not before_log or not after_log:
        return {"has_before": before_log is not None, "has_after": after_log is not None, "comparison": None}

    try:
        async with httpx.AsyncClient() as client:
            before_resp = await client.get(before_log.photo_url)
            after_resp = await client.get(after_log.photo_url)
            before_bytes = before_resp.content
            after_bytes = after_resp.content
    except Exception as e:
        print(f"Fetch error: {e}")
        return {"has_before": True, "has_after": True, "comparison": {"message": "Could not fetch images", "estimated_change": "N/A"}, "before_url": before_log.photo_url, "after_url": after_log.photo_url}

    before_meas = get_body_measurements(before_bytes)
    after_meas = get_body_measurements(after_bytes)

    if not before_meas or not after_meas:
        return {"has_before": True, "has_after": True, "comparison": {"message": "Could not detect body in one photo", "estimated_change": "N/A"}, "before_url": before_log.photo_url, "after_url": after_log.photo_url}

    whr_change = after_meas["waist_to_hip_ratio"] - before_meas["waist_to_hip_ratio"]
    shoulder_change = after_meas["shoulder_to_waist_ratio"] - before_meas["shoulder_to_waist_ratio"]

    feedback_parts = []
    if whr_change < -0.05:
        feedback_parts.append("Waist appears narrower relative to hips 👍")
    elif whr_change > 0.05:
        feedback_parts.append("Waist-to-hip ratio increased – focus on core and fat loss")
    else:
        feedback_parts.append("Waist-to-hip ratio stable")

    if shoulder_change > 0.05:
        feedback_parts.append("Shoulders look broader – great upper body development! 💪")
    elif shoulder_change < -0.05:
        feedback_parts.append("Shoulder width decreased – consider adding pulling exercises")
    else:
        feedback_parts.append("Shoulder width maintained")

    height_estimate = before_meas["torso_height"] * 2.5
    waist_estimate = before_meas["waist_to_hip_ratio"] * before_meas["hip_width"]
    before_bf = max(5, min(40, (waist_estimate / height_estimate) * 100))
    after_waist_estimate = after_meas["waist_to_hip_ratio"] * after_meas["hip_width"]
    after_bf = max(5, min(40, (after_waist_estimate / height_estimate) * 100))
    bf_change = after_bf - before_bf

    if bf_change < -1:
        feedback_parts.append(f"Estimated body fat reduced by {abs(bf_change):.1f}% 🎉")
    elif bf_change > 1:
        feedback_parts.append(f"Estimated body fat increased by {bf_change:.1f}% – review nutrition")
    else:
        feedback_parts.append("Body fat percentage stable")

    message = " ".join(feedback_parts)
    estimated_change = f"{bf_change:+.1f}% body fat (approx)"

    return {
        "has_before": True,
        "has_after": True,
        "before_url": before_log.photo_url,
        "after_url": after_log.photo_url,
        "comparison": {
            "message": message,
            "estimated_change": estimated_change,
            "metrics": {
                "waist_to_hip_before": round(before_meas["waist_to_hip_ratio"], 3),
                "waist_to_hip_after": round(after_meas["waist_to_hip_ratio"], 3),
                "shoulder_to_waist_before": round(before_meas["shoulder_to_waist_ratio"], 3),
                "shoulder_to_waist_after": round(after_meas["shoulder_to_waist_ratio"], 3)
            }
        }
    }

# ---------- WhatsApp Reminder ----------
@app.post("/api/reminders/whatsapp")
def whatsapp_reminder(req: WhatsAppReminderRequest, current_user: dict = Depends(get_current_user)):
    import urllib.parse
    clean_number = req.phone_number.replace('+', '').replace(' ', '').strip()
    message = f"Fitness Reminder: Time to {req.reminder_type}! Stay consistent. - AI Fitness Coach"
    encoded_msg = urllib.parse.quote(message)
    wa_link = f"https://wa.me/{clean_number}?text={encoded_msg}"
    return {"whatsapp_link": wa_link}

# ---------- Root ----------
@app.get("/")
def root():
    return {"message": "AI Fitness Model API running with full features"}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, UserProfile, DietPlan
from ..services.nutrition import calculate_calories, generate_meal_plan

router = APIRouter(prefix="/api/diet", tags=["diet"])

@router.post("/generate")
def generate_diet_plan(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["user_id"])
    profile = db.query(UserProfile).filter_by(user_id=user_id).first()
    if not profile:
        raise HTTPException(400, "Complete your profile first")
    tdee = calculate_calories(profile)
    adjustment = -500 if profile.fitness_goal == "weight_loss" else 300 if profile.fitness_goal == "muscle_gain" else 0
    target_calories = tdee + adjustment
    macros = {
        "protein_g": round((target_calories * 0.30) / 4),
        "carbs_g": round((target_calories * 0.40) / 4),
        "fat_g": round((target_calories * 0.30) / 9)
    }
    plan = generate_meal_plan(target_calories, macros, profile.dietary_restrictions)
    db_plan = DietPlan(user_id=user_id, plan_data=plan, calories=target_calories, macros=macros)
    db.add(db_plan)
    db.commit()
    return {"plan": plan, "calories": target_calories, "macros": macros}
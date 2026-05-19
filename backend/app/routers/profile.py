from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from ..database import get_db
from ..auth import get_current_user
from ..models import User, UserProfile

router = APIRouter(prefix="/api/profile", tags=["profile"])

class ProfileCreate(BaseModel):
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    fitness_goal: str
    activity_level: str
    dietary_restrictions: Optional[List[str]] = []

@router.post("/setup")
def setup_profile(data: ProfileCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["user_id"])
    existing = db.query(UserProfile).filter_by(user_id=user_id).first()
    if existing:
        raise HTTPException(400, "Profile already exists. Use PUT to update.")
    bmi = data.weight_kg / ((data.height_cm/100)**2)
    profile = UserProfile(
        user_id=user_id,
        age=data.age,
        gender=data.gender,
        height_cm=data.height_cm,
        weight_kg=data.weight_kg,
        bmi=bmi,
        fitness_goal=data.fitness_goal,
        activity_level=data.activity_level,
        dietary_restrictions=data.dietary_restrictions
    )
    db.add(profile)
    db.commit()
    return {"message": "Profile saved"}

@router.get("/")
def get_profile(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["user_id"])
    profile = db.query(UserProfile).filter_by(user_id=user_id).first()
    if not profile:
        raise HTTPException(404, "Profile not set up")
    return profile
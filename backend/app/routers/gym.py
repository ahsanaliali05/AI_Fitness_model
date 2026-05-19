from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Gym, Trainer

router = APIRouter(prefix="/api/gyms", tags=["gyms"])

@router.get("/")
def list_gyms(db: Session = Depends(get_db)):
    return db.query(Gym).all()

@router.get("/trainers")
def list_trainers(db: Session = Depends(get_db)):
    return db.query(Trainer).all()
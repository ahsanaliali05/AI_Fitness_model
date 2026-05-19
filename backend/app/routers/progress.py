from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, ProgressLog
import shutil
import os

router = APIRouter(prefix="/api/progress", tags=["progress"])

@router.post("/log")
async def log_progress(
    weight_kg: float = Form(...),
    notes: str = Form(""),
    photo: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = int(current_user["user_id"])
    photo_url = None
    if photo:
        os.makedirs("static/progress", exist_ok=True)
        file_path = f"static/progress/{user_id}_{photo.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        photo_url = file_path
    log = ProgressLog(user_id=user_id, weight_kg=weight_kg, photo_url=photo_url, notes=notes)
    db.add(log)
    db.commit()
    return {"message": "Progress logged"}
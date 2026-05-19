from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, ChatLog
from ..services.gpt import get_gpt_response

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatRequest(BaseModel):
    message: str

@router.post("/")
def chat(req: ChatRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["user_id"])
    # For simplicity, we don't fetch full user object; you can extend later
    context = "You are a certified fitness coach."
    bot_reply = get_gpt_response(req.message, context)
    log = ChatLog(user_id=user_id, user_msg=req.message, bot_reply=bot_reply)
    db.add(log)
    db.commit()
    return {"reply": bot_reply}
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)   # plain text
    role = Column(String(20), default='user')
    created_at = Column(DateTime, server_default=func.now())

class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    age = Column(Integer)
    gender = Column(String(10))
    height_cm = Column(Float)
    weight_kg = Column(Float)
    bmi = Column(Float)
    fitness_goal = Column(String(50))
    activity_level = Column(String(20))
    dietary_restrictions = Column(JSON)

class DietPlan(Base):
    __tablename__ = "diet_plans"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plan_data = Column(JSON, nullable=False)
    calories = Column(Float)
    macros = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())

class ProgressLog(Base):
    __tablename__ = "progress_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    weight_kg = Column(Float)
    body_fat = Column(Float, nullable=True)
    photo_url = Column(String(500), nullable=True)
    notes = Column(Text)
    logged_at = Column(DateTime, server_default=func.now())

class ChatLog(Base):
    __tablename__ = "chat_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user_msg = Column(Text, nullable=False)
    bot_reply = Column(Text, nullable=False)
    intent = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())

class Gym(Base):
    __tablename__ = "gyms"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    location = Column(String(300))
    contact = Column(String(100))
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

class Trainer(Base):
    __tablename__ = "trainers"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    gym_id = Column(Integer, ForeignKey("gyms.id"))
    speciality = Column(String(100))
    bio = Column(Text)
    
class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exercise = Column(String(50), nullable=False)
    rep_count = Column(Integer, nullable=False)
    avg_accuracy = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())    
    
class CompletedChallenge(Base):
    __tablename__ = "completed_challenges"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    challenge_id = Column(Integer, nullable=False)
    completed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    
class TrainerBooking(Base):
    __tablename__ = "trainer_bookings"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    trainer_id = Column(Integer, nullable=False)
    trainer_name = Column(String(100))
    booking_date = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending")  # pending, confirmed, cancelled
    created_at = Column(DateTime, server_default=func.now())

class SupplementLog(Base):
    __tablename__ = "supplement_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    supplement_name = Column(String(100))
    taken_at = Column(DateTime, server_default=func.now())

class WorkoutPlan(Base):
    __tablename__ = "workout_plans"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plan_data = Column(JSON, nullable=False)
    goal = Column(String(50))
    duration_days = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    
class ProgressPhoto(Base):
    __tablename__ = "progress_photos"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    photo_type = Column(String(20))  # 'before' or 'after'
    photo_url = Column(String(500))
    uploaded_at = Column(DateTime, server_default=func.now())
    notes = Column(Text, nullable=True)

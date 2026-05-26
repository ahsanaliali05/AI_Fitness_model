from pydantic import BaseModel
from typing import Optional

class UserSchema(BaseModel):
    id: int
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True  # enables ORM mode

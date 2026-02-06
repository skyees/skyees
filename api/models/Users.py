from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserModel(BaseModel):
    clerkId: str                                # required, unique
    username: Optional[str] = None
    status: Optional[str] = None
    profilePic: Optional[str] = None
    phoneNumber: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        schema_extra = {
            "example": {
                "clerkId": "user123",
                "username": "Raj",
                "status": "online",
                "profilePic": "https://example.com/raj.png",
                "phoneNumber": "9876543210",
                "createdAt": "2026-01-25T18:30:00Z"
            }
        }
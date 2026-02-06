from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ChatModel(BaseModel):
    isGroup: bool = False
    participants: List[str] = []   # store ObjectId as string
    name: Optional[str] = None     # only for group chats
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        schema_extra = {
            "example": {
                "isGroup": True,
                "participants": ["60f7c0f9e1d2f9a5b8c12345", "60f7c0f9e1d2f9a5b8c67890"],
                "name": "Study Group",
                "createdAt": "2026-01-25T18:30:00Z"
            }
        }
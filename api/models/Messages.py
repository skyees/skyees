from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ✅ Reaction schema
class ReactionModel(BaseModel):
    userId: str                      # Clerk/user ID
    emoji: str                       # "❤️" | "👍" | "😂" | "😮" | "😢" | "🙏"
    reactedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        schema_extra = {
            "example": {
                "userId": "user123",
                "emoji": "❤️",
                "reactedAt": "2026-01-25T18:30:00Z"
            }
        }

# ✅ Message schema
class MessageModel(BaseModel):
    clientId: Optional[str] = None   # ties client optimistic msg to server msg
    text: str = ""                   # default empty string
    image: Optional[str] = None
    audio: Optional[str] = None
    video: Optional[str] = None

    senderId: str                    # required
    receiverId: Optional[str] = None
    roomId: Optional[str] = None

    replyTo: Optional[str] = None    # store ObjectId as string

    createdAt: datetime = Field(default_factory=datetime.utcnow)
    edited: bool = False

    # ✅ new field for reactions
    reactions: List[ReactionModel] = []

    class Config:
        schema_extra = {
            "example": {
                "clientId": "abc123",
                "text": "Hello Raj, this is a test message",
                "senderId": "user123",
                "receiverId": "user456",
                "roomId": "room789",
                "replyTo": None,
                "createdAt": "2026-01-25T18:30:00Z",
                "edited": False,
                "reactions": [
                    { "userId": "user456", "emoji": "👍", "reactedAt": "2026-01-25T18:31:00Z" }
                ]
            }
        }
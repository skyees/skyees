from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class CallModel(BaseModel):
    callerId: str
    receiverId: str
    callerName: Optional[str] = None
    receiverName: Optional[str] = None
    callerImg: Optional[str] = None
    receiverImg: Optional[str] = None

    # Enums for call type and status
    callType: Literal["audio", "video"] = "audio"
    status: Literal["ringing", "accepted", "rejected", "missed", "ended"] = "ringing"

    startedAt: datetime = Field(default_factory=datetime.utcnow)
    answeredAt: Optional[datetime] = None
    endedAt: Optional[datetime] = None
    duration: Optional[int] = None

    class Config:
        schema_extra = {
            "example": {
                "callerId": "user123",
                "receiverId": "user456",
                "callerName": "Raj",
                "receiverName": "Alex",
                "callerImg": "https://example.com/raj.png",
                "receiverImg": "https://example.com/alex.png",
                "callType": "video",
                "status": "ringing",
                "startedAt": "2026-01-25T18:30:00Z",
                "answeredAt": None,
                "endedAt": None,
                "duration": None
            }
        }
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime

class RoomModel(BaseModel):
    name: str                                # required
    members: List[str] = []                  # store ObjectId as string
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        schema_extra = {
            "example": {
                "name": "Study Group",
                "members": ["60f7c0f9e1d2f9a5b8c12345", "60f7c0f9e1d2f9a5b8c67890"],
                "createdAt": "2026-01-25T18:30:00Z"
            }
        }
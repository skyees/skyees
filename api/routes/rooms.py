from fastapi import APIRouter, HTTPException, Depends
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os

router = APIRouter()

# MongoDB connection
client = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb+srv://skyees:raj1234%23A@skyees.oabwff3.mongodb.net/skyees?retryWrites=true&w=majority"))
db = client["skyees"]
messages_collection = db["messages"]
rooms_collection = db["rooms"]

# ✅ Clerk config (validates JWTs from Authorization header)
clerk_config = ClerkConfig(
    jwks_url="https://clerk.skyees.com/.well-known/jwks.json"
)
clerk_auth_guard = ClerkHTTPBearer(config=clerk_config)

# ✅ GET /api/rooms/my
@router.get("/my")
async def get_my_rooms(credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard)):
    try:
        clerk_id = credentials.decoded.get("sub")
        if not clerk_id:
            raise HTTPException(status_code=401, detail="Unauthorized: No Clerk userId")

        # Find all distinct roomIds the user is a member of
        roomIds = await messages_collection.distinct(
            "roomId",
            {"roomId": {"$exists": True}, "senderId": clerk_id}
        )
        return {"roomIds": roomIds}
    except Exception as e:
        print("Error fetching room IDs from messages:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch rooms")

# ✅ GET /api/rooms/{id}
@router.get("/{id}")
async def get_room(id: str, credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard)):
    try:
        clerk_id = credentials.decoded.get("sub")
        if not clerk_id:
            raise HTTPException(status_code=401, detail="Unauthorized: No Clerk userId")

        room = await rooms_collection.find_one({"_id": ObjectId(id)})
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        print("room", room)
        return {"roomName": room.get("name"), "roomPic": room.get("roomPic")}
    except Exception as e:
        print("Error fetching room:", e)
        raise HTTPException(status_code=500, detail="Server error fetching room")
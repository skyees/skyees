from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
router = APIRouter()

# MongoDB connection
client = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb+srv://skyees:raj1234%23A@skyees.oabwff3.mongodb.net/skyees?retryWrites=true&w=majority"))
db = client["skyees"]
messages_collection = db["messages"]
users_collection = db["users"]
rooms_collection = db["rooms"]

# Clerk auth dependency (like ClerkExpressRequireAuth)
# Clerk config
clerk_config = ClerkConfig(
    jwks_url="https://clerk.skyees.com/.well-known/jwks.json"
)
clerk_auth_guard = ClerkHTTPBearer(config=clerk_config)

# ✅ Private chat messages
@router.get("/private/{id}")
async def get_private_messages(id: str, credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard)):
    clerk_id = credentials.decoded.get("sub")
    if not clerk_id:
        raise HTTPException(status_code=401, detail="Unauthorized: No Clerk userId")
    
    myId = clerk_id
    id=id
    print("Fetching messages for Private chat: called step 1", {"id": id, "myId": myId})
    try:
        cursor = messages_collection.find({
            "$or": [
                {"senderId": myId, "receiverId": id},
                {"senderId": id, "receiverId": myId}
            ]
        }).sort("createdAt", 1)
        messages = await cursor.to_list(length=None)

        userIds = list(set([msg["senderId"] for msg in messages]))
        users_cursor = users_collection.find({"clerkId": {"$in": userIds}})
        users = await users_cursor.to_list(length=None)

        # Build user map
        userMap = {user["clerkId"]: user for user in users}

        enriched = []
        for msg in messages:
            enriched.append({
                **msg,
                "senderName": userMap.get(msg["senderId"], {}).get("username", msg["senderId"]),
                "senderPhoto": userMap.get(msg["senderId"], {}).get("profilePic", None)
            })

        print("Fetching messages for Private chat:", enriched)
        return enriched
    except Exception as e:
        print("Private message fetch error:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch private messages")

# ✅ Room chat messages
@router.get("/room/{id}")
async def get_room_messages(id: str, credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard)):
    print("Fetching messages for roomId:", id)
    try:
        cursor = messages_collection.find({"roomId": id}).sort("createdAt", 1)
        messages = await cursor.to_list(length=None)

        userIds = list(set([msg["senderId"] for msg in messages]))
        users_cursor = users_collection.find({"clerkId": {"$in": userIds}})
        users = await users_cursor.to_list(length=None)

        userMap = {user["clerkId"]: user.get("username") for user in users}

        room = await rooms_collection.find_one({"_id": ObjectId(id)})

        enriched = []
        for msg in messages:
            enriched.append({
                **msg,
                "senderName": userMap.get(msg["senderId"], msg["senderId"]) or "Unknown",
                "roomName": room.get("name") if room else "Room"
            })

        print("✅ Room messages count:", len(enriched))
        return enriched
    except Exception as e:
        print("Room message fetch error:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch room messages")
from fastapi import APIRouter, HTTPException, Depends
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter()

# ✅ MongoDB connection
client = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb+srv://skyees:raj1234%23A@skyees.oabwff3.mongodb.net/skyees?retryWrites=true&w=majority"))
db = client["skyees"]
messages_collection = db["messages"]

# ✅ Clerk config (validates JWTs from Authorization header)
clerk_config = ClerkConfig(
    jwks_url="https://clerk.skyees.com/.well-known/jwks.json"
)
clerk_auth_guard = ClerkHTTPBearer(config=clerk_config)

@router.get("/list")
async def get_chats(credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard)):
    print("📡 /api/chats/list called by:", credentials.decoded.get("sub")) # Added log
    try:
        myId = credentials.decoded.get("sub")

        oneToOne = await messages_collection.aggregate([
            {
                "$match": {
                    "$or": [{"senderId": myId}, {"receiverId": myId}],
                    "roomId": {"$exists": False}
                }
            },
            {"$sort": {"createdAt": -1}},
            {
                "$group": {
                    "_id": {
                        "$cond": [
                            {"$eq": ["$senderId", myId]},
                            "$receiverId",
                            "$senderId"
                        ]
                    },
                    "lastMessage": {"$first": "$$ROOT"}
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "_id", # This is the other user's ID
                    "foreignField": "clerkId",
                    "as": "contact"
                }
            },
            {"$unwind": {"path": "$contact", "preserveNullAndEmptyArrays": True}},
            {
                "$project": {
                    "_id": 0,
                    "userId": "$_id",
                    "lastMessageText": "$lastMessage.text",
                    "lastMessageTime": "$lastMessage.createdAt",
                    "contactName": {"$ifNull": ["$contact.username", "Unknown User"]},
                    "contactPhoto": "$contact.profilePic"
                }
            }
        ]).to_list(length=None)

        return {"oneToOne": oneToOne, "rooms": []} # Simplified for debugging
    except Exception as e:
        print("❌ Error in /api/chats/list:", str(e))
        raise HTTPException(status_code=500, detail="Server error fetching chats")
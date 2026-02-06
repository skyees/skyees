from fastapi import APIRouter, Depends, HTTPException
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter()

# Clerk config
clerk_config = ClerkConfig(
    jwks_url="https://clerk.skyees.com/.well-known/jwks.json"
)
clerk_auth_guard = ClerkHTTPBearer(config=clerk_config)

# MongoDB setup
client = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb+srv://skyees:raj1234%23A@skyees.oabwff3.mongodb.net/skyees?retryWrites=true&w=majority"))
db = client["skyees"]
users_collection = db["users"]

# ✅ GET /api/users → list all users except current
@router.get("")
async def get_users(credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard)):
    clerk_id = credentials.decoded.get("sub")
    if not clerk_id:
        raise HTTPException(status_code=401, detail="Unauthorized: No Clerk userId")

    users = await users_collection.find({"clerkId": {"$ne": clerk_id}}).to_list(length=100)
    for u in users:
        if "_id" in u:
            u["_id"] = str(u["_id"])
    return users

# ✅ GET /api/users/{id} → get user by Clerk ID
@router.get("/{id}")
async def get_user(id: str):
    user = await users_collection.find_one({"clerkId": id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if "_id" in user:
        user["_id"] = str(user["_id"])
    return user
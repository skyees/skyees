const express = require("express");
const router = express.Router();
const User = require("../models/User");
require('dotenv').config();
const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");
# ✅ POST /api/users/profile → create or update profile
@router.post("")
async def save_profile(
    profile: dict,
    credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard)
):
    clerk_id = credentials.decoded.get("sub")
    if not clerk_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await users_collection.find_one({"clerkId": clerk_id})

    if not user:
        new_user = {
            "clerkId": clerk_id,
            "username": profile.get("username"),
            "status": profile.get("status"),
            "profilePic": profile.get("profilePic"),
            "phoneNumber": profile.get("phoneNumber"),
        }
        result = await users_collection.insert_one(new_user)
        new_user["_id"] = str(result.inserted_id)
        return new_user
    else:
        updates = {}
        for field in ["username", "status", "profilePic", "phoneNumber"]:
            if profile.get(field) is not None:
                updates[field] = profile[field]

        if updates:
            await users_collection.update_one({"clerkId": clerk_id}, {"$set": updates})
            user.update(updates)

        if "_id" in user:
            user["_id"] = str(user["_id"])
        return user

# ✅ GET /api/users/profile → get logged-in user's profile
@router.get("")
async def get_profile(credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard)):
    clerk_id = credentials.decoded.get("sub")
    user = await users_collection.find_one({"clerkId": clerk_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if "_id" in user:
        user["_id"] = str(user["_id"])
    return user

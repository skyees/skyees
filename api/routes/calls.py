from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import os
import store  # <--- IMPORT SHARED STORE

router = APIRouter()

# --- Database Setup ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://skyees:raj1234%23A@skyees.oabwff3.mongodb.net/skyees?retryWrites=true&w=majority")
client = AsyncIOMotorClient(MONGO_URI)
db = client["skyees"]
calls_collection = db["calls"]
users_collection = db["users"]

# --- Create Call ---
@router.post("")
async def create_call(body: dict, request: Request):
    # 🚨 LOG TAG TO PROVE FILE IS UPDATED
    print("📞 [FINAL_FIX] POST /api/calls hit") 
    
    callerId = body.get("callerId")
    receiverId = body.get("receiverId")
    callType = body.get("callType", "audio")

    new_call = {
        "callerId": callerId,
        "receiverId": receiverId,
        "callType": callType,
        "status": "ringing",
        "startedAt": datetime.utcnow(),
        "createdAt": datetime.utcnow(),
    }
    result = await calls_collection.insert_one(new_call)
    new_call["_id"] = str(result.inserted_id)

    # Fetch Caller Profile
    caller_profile = await users_collection.find_one({"clerkId": callerId})
    payload = {
        **new_call,
        "callerName": caller_profile.get("username") if caller_profile else "Unknown Caller",
        "callerImg": caller_profile.get("profilePic") if caller_profile else None,
    }
    for k, v in payload.items():
        if isinstance(v, datetime): payload[k] = v.isoformat()

    # 🚨 READ FROM STORE (SHARED MEMORY)
    receiver_socket_id = store.online_users.get(receiverId)
    
    print(f"🔍 [FINAL_FIX] Looking for user {receiverId} in store")
    print(f"🔍 [FINAL_FIX] Store has {len(store.online_users)} users")

    if receiver_socket_id and store.io_instance:
        await store.io_instance.emit("incoming-call", payload, to=receiver_socket_id)
        print(f"✅ [FINAL_FIX] Emitted incoming-call to {receiver_socket_id}")
    else:
        print(f"⚠️ [FINAL_FIX] Receiver {receiverId} not online")

    return new_call

# --- Accept Call ---
@router.put("/accept")
async def accept_call(body: dict):
    callId = body.get("callId")
    call = await calls_collection.find_one({"_id": ObjectId(callId)})
    
    if call:
        await calls_collection.update_one(
            {"_id": ObjectId(callId)}, 
            {"$set": {"status": "accepted", "answeredAt": datetime.utcnow()}}
        )
        
        caller_socket_id = store.online_users.get(call["callerId"])
        
        if caller_socket_id and store.io_instance:
            call["_id"] = str(call["_id"])
            for k, v in call.items():
                if isinstance(v, datetime): call[k] = v.isoformat()

            await store.io_instance.emit("call-accepted", call, to=caller_socket_id)
            await store.io_instance.emit("receiver-ready", {"callId": callId, "from": call["receiverId"]}, to=caller_socket_id)

    return {"status": "ok"}

# --- End Call ---
@router.put("/end")
async def end_call(body: dict):
    print("📥 [FINAL_FIX] PUT /api/calls/end hit")
    callId = body.get("callId")
    status = body.get("status")

    if not callId: return {"error": "callId required"}

    call = await calls_collection.find_one({"_id": ObjectId(callId)})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    await calls_collection.update_one(
        {"_id": ObjectId(callId)},
        {"$set": {"status": status, "endedAt": datetime.utcnow()}}
    )

    # 🚨 READ FROM STORE (SHARED MEMORY)
    caller_socket = store.online_users.get(call["callerId"])
    receiver_socket = store.online_users.get(call["receiverId"])

    print(f"🔍 [FINAL_FIX] End Call - CallerSocket: {caller_socket}")
    print(f"🔍 [FINAL_FIX] End Call - ReceiverSocket: {receiver_socket}")

    call["status"] = status
    call["_id"] = str(call["_id"])
    for k, v in call.items():
        if isinstance(v, datetime): call[k] = v.isoformat()

    if caller_socket and store.io_instance:
        await store.io_instance.emit("call-ended", call, to=caller_socket)
        print("✅ [FINAL_FIX] Sent to Caller")
        
    if receiver_socket and store.io_instance:
        await store.io_instance.emit("call-ended", call, to=receiver_socket)
        print("✅ [FINAL_FIX] Sent to Receiver")

    return call
import socketio
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime
from bson import ObjectId
from fastapi.encoders import ENCODERS_BY_TYPE
from fastapi.middleware.cors import CORSMiddleware
import store
from routes import user, calls, rooms, messages, chats, health, profile

app = FastAPI(redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(cors_allowed_origins="*", async_mode="asgi")
store.io_instance = sio 

socket_app = socketio.ASGIApp(sio)
app.mount("/socket.io", socket_app)

# REST Routes
app.include_router(user.router, prefix="/pyapi/api/users", tags=["users"])
app.include_router(chats.router, prefix="/pyapi/api/chats", tags=["chats"])
app.include_router(calls.router, prefix="/pyapi/api/calls", tags=["calls"])
app.include_router(rooms.router, prefix="/pyapi/api/rooms", tags=["rooms"])
app.include_router(messages.router, prefix="/pyapi/api/messages", tags=["messages"])
app.include_router(health.router, prefix="/pyapi/api", tags=["system"])   
app.include_router(profile.router, prefix="/pyapi/api/users/profile", tags=["profile"])

ENCODERS_BY_TYPE[ObjectId] = str

client = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb+srv://skyees:raj1234%23A@skyees.oabwff3.mongodb.net/skyees?retryWrites=true&w=majority"))
db = client["skyees"]
messages = db["messages"]

# --- SOCKET EVENTS ---

@sio.on("connect")
async def connect(sid, environ):
    print("⚡ New socket connected:", sid)

@sio.on("register")
async def register(sid, userId):
    if userId:
        store.online_users[userId] = sid
        print(f"🟢 Registered {userId} -> {sid}")
        await sio.emit("user-online", userId, to=sid)

@sio.on("call-end")
async def call_end(sid, data):
    to = data.get("to")
    target_socket = store.online_users.get(to)
    if target_socket:
        await sio.emit("call-ended", data, to=target_socket)

@sio.on("disconnect")
async def disconnect(sid):
    offlineUser = None
    for userId, socketId in list(store.online_users.items()):
        if socketId == sid:
            offlineUser = userId
            del store.online_users[userId]
            print(f"❌ User {userId} disconnected")
            break
    if offlineUser:
        await sio.emit("user-offline", offlineUser)

# --- 🚨 CRITICAL WEBRTC EVENTS (DO NOT REMOVE) 🚨 ---

@sio.on("offer")
async def offer(sid, data):
    callId = data.get("callId")
    to = data.get("to")
    # Read from store
    receiverSocketId = store.online_users.get(to) 
    if receiverSocketId:
        await sio.emit("offer", {"offer": data.get("offer"), "callId": callId}, to=receiverSocketId)
        print(f"📤 Relayed offer to {receiverSocketId}")
    else:
        print(f"⚠️ Offer failed: Receiver {to} not online")

@sio.on("answer")
async def answer(sid, data):
    callId = data.get("callId")
    to = data.get("to")
    callerSocketId = store.online_users.get(to)
    if callerSocketId:
        await sio.emit("answer", {"answer": data.get("answer"), "callId": callId}, to=callerSocketId)
        print(f"📤 Relayed answer to {callerSocketId}")
    else:
        print(f"⚠️ Answer failed: Caller {to} not online")

@sio.on("ice-candidate")
async def ice_candidate(sid, data):
    callId = data.get("callId")
    to = data.get("to")
    targetSocketId = store.online_users.get(to)
    if targetSocketId:
        await sio.emit("ice-candidate", {"candidate": data.get("candidate"), "callId": callId}, to=targetSocketId)
        print(f"🧊 Relayed ICE candidate to {targetSocketId}")
    else:
        print(f"⚠️ ICE failed: Target {to} not online")

# --- Chat Events (Keep these too) ---

@sio.on("join-room")
async def join_room(sid, roomId):
    sio.enter_room(sid, roomId)

@sio.on("new-message")
async def new_message(sid, msg):
    try:
        senderId = msg.get("senderId")
        text = msg.get("text")
        roomId = msg.get("roomId")
        receiverId = msg.get("receiverId")

        message_doc = {
            "senderId": senderId,
            "text": text or "",
            "roomId": roomId,
            "receiverId": receiverId,
           "timestamp": datetime.now().isoformat()
        }
        result = await messages.insert_one(message_doc)
        message_doc["_id"] = str(result.inserted_id)
        
        if roomId:
            await sio.emit("room-message", message_doc, room=roomId)
        if receiverId:
            await sio.emit("private-message", message_doc, to=sid)
            if receiverId in store.online_users:
                await sio.emit("private-message", message_doc, to=store.online_users[receiverId])
    except Exception as e:
        print("❌ new-message error:", e)

@sio.on("typing")
async def typing(sid, data):
    roomId = data.get("roomId")
    receiverId = data.get("receiverId")
    if roomId:
        await sio.emit("typing", data, room=roomId)
    elif receiverId in store.online_users:
        await sio.emit("typing", data, to=store.online_users[receiverId])

@sio.on("stop-typing")
async def stop_typing(sid, data):
    roomId = data.get("roomId")
    receiverId = data.get("receiverId")
    if roomId:
        await sio.emit("stop-typing", data, room=roomId)
    elif receiverId in store.online_users:
        await sio.emit("stop-typing", data, to=store.online_users[receiverId])

@app.get("/")
def root():
    return {"message": "API is running ✅"}
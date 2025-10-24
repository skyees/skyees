require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const Message = require('./models/Message');
const userRoutes = require("./routes/user");
const chatRoutes = require("./routes/chats");
const messageRoutes = require("./routes/messages");
const myroomRoutes = require("./routes/rooms");
const callsRoutesFactory = require("./routes/calls");

const { ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  }
});

// 🧠 Track online users
const onlineUsers = new Map();

app.use(ClerkExpressWithAuth());
app.use(cors());
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/rooms", myroomRoutes);
const callRoutes = callsRoutesFactory(io);
app.use("/api/calls", callRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(process.env.PORT, "0.0.0.0", () =>
      console.log(`🚀 Server running on port ${process.env.PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB error:", err));

io.on("connection", (socket) => {
  console.log("⚡ New socket connected:", socket.id);

  // Store userId when they come online
  socket.on("register-user", (userId) => {
    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;
      console.log(`✅ Registered ${userId} with socket ${socket.id}`);
    }
  });

  // ========= 🧩 EXISTING CHAT LOGIC (Unchanged) =========
  socket.on("join-rooms", (roomIds) => {
    if (Array.isArray(roomIds)) {
      roomIds.forEach(roomId => {
        socket.join(roomId);
        console.log(`✅ Socket ${socket.id} joined room ${roomId}`);
      });
    }
  });

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`👥 Joined room ${roomId}`);
  });

  socket.on("new-message", async (msg) => {
    try {
      const { senderId, receiverId, roomId, text, image, audio, video, createdAt } = msg;

      const messageData = {
        senderId,
        text,
        image,
        audio,
        video,
        createdAt: createdAt || new Date(),
      };

      if (roomId) messageData.roomId = roomId;
      else if (receiverId) messageData.receiverId = receiverId;

      const message = new Message(messageData);
      const savedMessage = await message.save();

      if (savedMessage.roomId) {
        io.to(savedMessage.roomId).emit("room-message", savedMessage);
      } else if (savedMessage.receiverId) {
        const receiverSocketId = onlineUsers.get(savedMessage.receiverId);
        socket.emit('private-message', savedMessage);

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("private-message", savedMessage);
        }
      }
    } catch (err) {
      console.error("❌ Error saving message:", err.message);
    }
  });

  socket.on('edit-message', async ({ messageId, newText }) => {
    try {
      const updated = await Message.findByIdAndUpdate(
        messageId,
        { text: newText },
        { new: true }
      );
      io.emit('message-edited', updated);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  });

  socket.on('delete-message', async ({ messageId }) => {
    try {
      const deletedMessage = await Message.findByIdAndDelete(messageId);
      if (deletedMessage) {
        io.emit('message-deleted', { messageId });
      }
    } catch (err) {
      console.error('❌ Error deleting message:', err);
    }
  });

  // ========= 🧠 NEW SECTION: WebRTC Signaling =========

  // 1️⃣ Caller initiates call
  socket.on("call-user", ({ to, offer, from }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("incoming-call", { from, offer });
      console.log(`📞 Call offer sent from ${from} to ${to}`);
    } else {
      console.log("❌ User not online:", to);
    }
  });

  // 2️⃣ Callee answers call
  socket.on("answer-call", ({ to, answer }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("call-answered", { answer });
      console.log(`✅ Call answered, sent to ${to}`);
    }
  });

  // 3️⃣ Exchange ICE candidates
  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("ice-candidate", { candidate });
      console.log(`🧊 ICE candidate relayed to ${to}`);
    }
  });

    // Save a call when it starts
    socket.on("start-call", async ({ callerId, receiverId, callType }) => {
      const call = new Call({ callerId, receiverId, callType });
      await call.save();

      const receiverSocket = onlineUsers.get(receiverId);
      if (receiverSocket) {
        io.to(receiverSocket).emit("incoming-call", { callerId, callType });
      }

      console.log(`📞 ${callerId} started a ${callType} call with ${receiverId}`);
    });
    socket.on('decline-call', async ({ callId, userId }) => {
      const updated = await Call.findByIdAndUpdate(callId, { status: 'rejected' }, { new: true });
      io.to(`user_${updated.callerId}`).emit('call-updated', updated);
      io.to(`user_${updated.receiverId}`).emit('call-updated', updated);
    });

  socket.on('end-call', async ({ callId, userId }) => {
   const callObj = await Call.findById(callId);
   if (!callObj) return;
   const endedAt = new Date();
   const duration = callObj.answeredAt ? Math.floor((endedAt - callObj.answeredAt)/1000) : 0;
   const updated = await Call.findByIdAndUpdate(callId, { status: 'ended', endedAt, duration }, { new: true });
   io.to(`user_${updated.callerId}`).emit('call-ended', updated);
   io.to(`user_${updated.receiverId}`).emit('call-ended', updated);
 });

  // ========= 🧹 Cleanup =========
  socket.on("disconnect", () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      console.log(`🔌 Disconnected: ${socket.userId}`);
    }
  });
});

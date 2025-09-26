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
app.use("/api/chats",chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/rooms", myroomRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(process.env.PORT, "0.0.0.0",() =>
      console.log(`🚀 Server running on port ${process.env.PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB error:", err));

io.on("connection", (socket) => {
  console.log("⚡ New socket connected:", socket.id);

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
      const { senderId, receiverId, roomId, text, createdAt } = msg;

      const messageData = {
        senderId,
        text,
        createdAt: createdAt || new Date(),
      };

      if (roomId) {
        messageData.roomId = roomId;
        const message = new Message(messageData);
        await message.save();

        socket.to(roomId).emit("room-message", message);
        console.log("📢 Room message sent to", roomId);
      } else if (receiverId) {
        messageData.receiverId = receiverId;
        const message = new Message(messageData);
        await message.save();

        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("private-message", message);
          console.log("📩 Message sent to receiver", receiverId);
        } else {
          console.log("❌ Receiver not online:", receiverId);
        }
      }
    } catch (err) {
      console.error("❌ Error saving message:", err.message);
    }
  });

  socket.on("disconnect", () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      console.log(`🔌 Disconnected: ${socket.userId}`);
    }
  });
});

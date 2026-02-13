require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const User = require('./models/User');
const Message = require('./models/Message');
const Chat = require('./models/Chat'); // ✅ Added Chat Model
const userRoutes = require("./routes/user");
const chatRoutes = require("./routes/chats");
const messageRoutes = require("./routes/messages");
const myroomRoutes = require("./routes/rooms");
const callsRoutesFactory = require("./routes/calls");
const paymentRouter = require('./routes/payment');

const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"] },
});

// track online users: key = userId (string), value = socket.id
const onlineUsers = new Map();

app.use(ClerkExpressRequireAuth());
app.use(cors());
app.use(express.json());

// expose for route handlers to use
app.set('io', io);
app.set('onlineUsers', onlineUsers);

const callRoutes = callsRoutesFactory();

app.get("/", (req, res) => {
  res.send("API is running ✅");
});

app.use("/api/calls", callRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/rooms", myroomRoutes);
app.use('/api/payments', paymentRouter);

// DB + start
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(process.env.PORT || 3000, "0.0.0.0", () =>
      console.log(`🚀 Server running on port ${process.env.PORT || 3000}`)
    );
  })
  .catch(err => console.error("❌ MongoDB error:", err));

// ---------------- Socket logic ----------------
io.on("connection", (socket) => {
  console.log("⚡ New socket connected:", socket.id);

  // Register user -> map userId to socket.id
  socket.on("register", (userId) => {
    try {
      if (!userId) return;
      const uid = String(userId);
      onlineUsers.set(uid, socket.id);
      console.log(`🟢 Registered ${uid} -> ${socket.id} (onlineUsers size: ${onlineUsers.size})`);
      socket.emit("user-online", uid);
    } catch (e) {
      console.error('⚠️ register handler error', e);
    }
  });

  // --- 🚀 NEW: GROUP CALL LOGIC (Injected) ---
  socket.on("group-call-invite", ({ callId, inviteeId, initiatorName, type }) => {
    const inviteeSocketId = onlineUsers.get(String(inviteeId));
    if (inviteeSocketId) {
      console.log(`📤 Group Invite: ${initiatorName} -> ${inviteeId} (Call: ${callId})`);
      // Reuse your existing incoming-call event so the frontend "just works"
      io.to(inviteeSocketId).emit("incoming-call", {
        callId,
        callerId: socket.userId || initiatorName, // Fallback if userId isn't on socket
        callerName: `${initiatorName}`,
        type,
        isGroup: true // Flag to identify it's an addition to a call
      });
    }
  });

  socket.on("join-group-call", ({ callId }) => {
    socket.join(callId);
    console.log(`👥 Socket ${socket.id} joined group room: ${callId}`);
    // Notify others in the room
    socket.to(callId).emit("participant-joined", {
      userId: socket.userId,
      socketId: socket.id
    });
  });
  
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
      let {
        id: clientId,
        text,
        senderId,
        receiverId,
        roomId, // This functions as the Chat ID
        image,
        audio,
        video,
        createdAt,
        replyTo
      } = msg;

      console.log("📨 Processing message...");

      // ✅ FIX 1: Find or Create Chat ID if missing (Prevents separate chat threads)
      if (!roomId && receiverId) {
        const existingChat = await Chat.findOne({
          isGroupChat: false,
          $and: [
            { users: { $elemMatch: { $eq: senderId } } },
            { users: { $elemMatch: { $eq: receiverId } } },
          ],
        });

        if (existingChat) {
          roomId = existingChat._id.toString();
        } else {
          // Fallback: Create chat if it doesn't exist to prevent orphans
          const chatData = {
            chatName: "sender",
            isGroupChat: false,
            users: [senderId, receiverId],
          };
          const createdChat = await Chat.create(chatData);
          roomId = createdChat._id.toString();
        }
      }

      // ---- sender info ----
      const sender = await User.findOne({ clerkId: senderId }).lean();
      const senderName = sender?.username || sender?.name || "User";

      // ---- reply object ----
      let replyToObj = null;
      if (replyTo) {
        const original = await Message.findById(replyTo).lean();
        if (original) {
          replyToObj = {
            _id: original._id,
            text: original.text,
            image: original.image,
            video: original.video,
            audio: original.audio,
            senderId: original.senderId,
          };
        }
      }

      // ---- save message ----
      const saved = await Message.create({
        clientId,
        text: text || "",
        senderId,
        receiverId,
        roomId,
        chat: roomId, // ✅ Ensure linkage
        image,
        audio,
        video,
        replyTo: replyToObj,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        status: "sent"
      });

      // ✅ FIX 2: Update Latest Message in Chat
      if (roomId) {
        await Chat.findByIdAndUpdate(roomId, { latestMessage: saved._id });
      }

      const outgoing = {
        _id: saved._id,
        clientId,
        text: saved.text,
        senderId,
        senderName,
        receiverId,
        roomId,
        image,
        audio,
        video,
        replyTo: replyToObj,
        createdAt: saved.createdAt,
        status: "sent"
      };

      // =====================
      // PRIVATE DELIVERY
      // =====================
      if (receiverId) {
        const receiverSocket = onlineUsers.get(String(receiverId));

        // sender ack
        socket.emit("private-message", outgoing);

        if (receiverSocket) {
          // send to receiver
          io.to(receiverSocket).emit("private-message", outgoing);

          // ✅ UPDATE DB → delivered
          await Message.findByIdAndUpdate(saved._id, {
            status: "delivered"
          });

          // ✅ notify sender → double tick
          io.to(socket.id).emit("message-delivered", {
            messageId: saved._id
          });
        }
      }

      // =====================
      // ROOM DELIVERY
      // =====================
      if (roomId) {
        io.to(roomId).emit("room-message", outgoing);

        const members = io.sockets.adapter.rooms.get(roomId);

        if (members && members.size > 1) {
          // ✅ persist delivered
          await Message.findByIdAndUpdate(saved._id, {
            status: "delivered"
          });

          io.to(socket.id).emit("message-delivered", {
            messageId: saved._id
          });
        }
      }

    } catch (err) {
      console.error("❌ new-message error:", err);
    }
  });

  socket.on("messages-seen", async ({ withUser }) => {
    try {
      await Message.updateMany(
        {
          senderId: withUser,
          receiverId: { $exists: true },
          status: "delivered"
        },
        { status: "seen" }
      );

      const senderSocket = onlineUsers.get(String(withUser));

      if (senderSocket) {
        io.to(senderSocket).emit("messages-seen-update", {
          withUser
        });
      }
    } catch (e) {
      console.error("seen update error", e);
    }
  });

  // ✅ FIX: Expect 'text', not 'newText' to match frontend payload
  socket.on("edit-message", async ({ messageId, text }) => {
    try {
      const updated = await Message.findByIdAndUpdate(
        messageId,
        { text: text, edited: true },
        { new: true }
      ).lean();
      if (updated) io.emit("message-edited", updated);
    } catch (e) { console.error("edit-message error:", e); }
  });

  socket.on("delete-message", async ({ messageId }) => {
    try {
      const del = await Message.findByIdAndDelete(messageId);
      if (del) io.emit("message-deleted", { messageId });
    } catch (e) { console.error("delete-message error:", e); }
  });

  // Call handling logic remains unchanged
  socket.on("offer", ({ offer, callId, to }) => {
    const receiverSocketId = onlineUsers.get(String(to));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("offer", { offer, callId });
    }
  });

  socket.on("answer", ({ answer, callId, to }) => {
    const callerSocketId = onlineUsers.get(String(to));
    if (callerSocketId) {
      io.to(callerSocketId).emit("answer", { answer, callId });
    }
  });

  socket.on("ice-candidate", ({ candidate, callId, to }) => {
    const targetSocketId = onlineUsers.get(String(to));
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", { candidate, callId });
    }
  });

  socket.on("typing", ({ senderId, receiverId, roomId }) => {
    if (roomId) {
      io.to(roomId).emit("typing", { senderId, roomId });
    } else if (receiverId) {
      const receiverSocket = onlineUsers.get(String(receiverId));
      if (receiverSocket) {
        io.to(receiverSocket).emit("typing", { senderId, receiverId });
      }
    }
  });

  socket.on("stop-typing", ({ senderId, receiverId, roomId }) => {
    if (roomId) {
      io.to(roomId).emit("stop-typing", { senderId, roomId });
    } else if (receiverId) {
      const receiverSocket = onlineUsers.get(String(receiverId));
      if (receiverSocket) {
        io.to(receiverSocket).emit("stop-typing", { senderId, receiverId });
      }
    }
  });

  // cleanup on disconnect
  socket.on("disconnect", () => {
    let offlineUser = null;
    for (const [userId, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        offlineUser = userId;
        onlineUsers.delete(userId);
        break;
      }
    }
    if (offlineUser) {
      socket.broadcast.emit("user-offline", offlineUser);
    }
  });
});
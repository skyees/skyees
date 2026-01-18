require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const User = require('./models/User');
const Message = require('./models/Message');
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

// track online users: key = userId (the same id you send from client), value = socket.id
const onlineUsers = new Map();

app.use(ClerkExpressRequireAuth());
app.use(cors());
app.use(express.json());

// expose for route handlers to use
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// mount routes (callsRoutesFactory doesn't need parameter because routes read io from req.app)
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
      onlineUsers.set(userId, socket.id);
      console.log(`🟢 Registered ${userId} -> ${socket.id} (onlineUsers size: ${onlineUsers.size})`);
      socket.emit("user-online", userId);
    } catch (e) {
      console.error('⚠️ register handler error', e);
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
        const {
          id: clientId,
          text,
          senderId,
          receiverId,
          roomId,
          image,
          audio,
          video,
          createdAt,
          replyTo
        } = msg;

        // ✅ Sender details
        const sender = await User.findOne({ clerkId: senderId }).lean();
        const senderName = sender?.name || sender?.username || "Unknown";

        // ✅ Prepare reply object
        let replyToObj = null;
        if (replyTo) {
          const original = await Message.findById(replyTo).lean();
          if (original) {
            const senderUser = await User.findOne({ clerkId: original.senderId }).lean();
            replyToObj = {
              _id: original._id,
              text: original.text || "",
              senderId: original.senderId,
              senderName: senderUser?.name || "Unknown",
              image: original.image || null,
              video: original.video || null,
              audio: original.audio || null
            };
          }
        }

        // ✅ Build message data
        const messageData = {
          senderId,
          senderName,
          text: text || "",
          image: image || null,
          audio: audio || null,
          video: video || null,
          replyTo: replyToObj,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        };

        // ✅ Add receiver/group target
        if (receiverId) messageData.receiverId = receiverId;
        if (roomId) messageData.roomId = roomId;

        // ✅ Save message
        const saved = await Message.create(messageData);

      const outgoing = {
        _id: saved._id,
        clientId,
        text: saved.text,
        createdAt: saved.createdAt,
        senderId,
        senderName,
        receiverId,
        roomId,
        replyTo: replyToObj,
        image,
        video,
        audio
      };
        // ✅ Emit to correct users
        if (roomId) {
          io.to(roomId).emit("room-message", outgoing);
        }

        if (receiverId) {
          socket.emit("private-message", outgoing);

          const receiverSocketId = onlineUsers.get(receiverId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("private-message", outgoing);
          }
        }

      } catch (err) {
        console.error("❌ new-message error:", err);
      }
    });


    socket.on("edit-message", async ({ messageId, newText }) => {
      try {
        const updated = await Message.findByIdAndUpdate(
          messageId,
          { text: newText, edited: true },
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

  // Relay offer to receiver socket
  socket.on("offer", ({ offer, callId, to }) => {
   console.log("📤 offer:,callId,To", callId, to);
    const onlineUsers = app.get("onlineUsers");
    const receiverSocketId = onlineUsers.get(to); // 'to' is Clerk ID
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("offer", { offer, callId });
      console.log("📤 Relayed offer to receiver socket:", receiverSocketId);
    } else {
      console.warn("⚠️ Receiver socket not found for Clerk ID:", to);
    }
  });


    // Relay answer to caller
    socket.on("answer", ({ answer, callId, to }) => {
      const callerSocketId = onlineUsers.get(to);
      if (callerSocketId) {
        io.to(callerSocketId).emit("answer", { answer, callId });
        console.log(`📤 Relayed answer to caller socket ${callerSocketId} for call ${callId}`);
      } else {
        console.warn(`⚠️ Answer relay failed — caller ${to} not online`);
      }
    });

    // Relay ICE candidate
    socket.on("ice-candidate", ({ candidate, callId, to }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("ice-candidate", { candidate, callId });
        console.log(`🧊 Relayed ICE candidate to ${targetSocketId} for call ${callId}`);
      } else {
        console.warn(`⚠️ ICE relay failed — target ${to} not online`);
      }
    });

    socket.on("typing", ({ senderId, receiverId, roomId }) => {
      if (roomId) {
        io.to(roomId).emit("typing", { senderId, roomId });
      } else if (receiverId) {
        const receiverSocket = onlineUsers.get(receiverId);
        if (receiverSocket) {
          io.to(receiverSocket).emit("typing", { senderId, receiverId });
        }
      }
    });

    socket.on("stop-typing", ({ senderId, receiverId, roomId }) => {
      if (roomId) {
        io.to(roomId).emit("stop-typing", { senderId, roomId });
      } else if (receiverId) {
        const receiverSocket = onlineUsers.get(receiverId);
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
        offlineUsers = userId;
        onlineUsers.delete(userId);
        console.log(`❌ User ${userId} disconnected (socket ${socket.id}). onlineUsers size: ${onlineUsers.size}`);
        break;
      }
    }
    if (offlineUser){
     console.log("❌ User offline:", offlineUser);
     socket.emit("user-offline", offlineUser);
    }
  });
});

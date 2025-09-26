// backend/routes/rooms.js

const express = require("express");
const router = express.Router();
const { ClerkExpressWithAuth } = require("@clerk/clerk-sdk-node");
const clerkAuth = ClerkExpressWithAuth();

const Message = require("../models/Message");
const Room = require('../models/Room');

// GET /api/rooms/my - extract unique roomIds the user is part of via messages
router.get("/my", clerkAuth, async (req, res) => {
  const myId = req.auth.userId;
  try {
    // Find all distinct roomIds the user is a member of
    const roomIds = await Message.distinct("roomId", { 
      roomId: { $exists: true },
      senderId: myId // optionally also filter receiverId: myId if needed
    });

    res.json({ roomIds });
  } catch (err) {
    console.error("Error fetching room IDs from messages:", err);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// routes/rooms.js
router.get('/:id', async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  console.log('room',room);
  res.json({ roomName: room.name ,roomPic:room.roomPic});
});

module.exports = router;

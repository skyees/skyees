const router = require('express').Router();
const mongoose = require("mongoose");
const Message = require('../models/Message');
const User = require('../models/User');
const Room = require('../models/Room');
const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");

const clerkAuth = ClerkExpressRequireAuth();

// ✅ Private chat messages
router.get('/private/:id', clerkAuth, async (req, res) => {
  const { id } = req.params;
  const myId = req.auth.userId;
  console.log('Fetching messages for Private chat: called step 1', { id, myId });
  try {
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: id },
        { senderId: id, receiverId: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    const userIds = [...new Set(messages.map(msg => msg.senderId))];
    const users = await User.find({ clerkId: { $in: userIds } }).lean();
    const userMap = Object.fromEntries(users.map(user => [user.clerkId, user.username]));

    const enriched = messages.map(msg => ({
      ...msg,
      senderName: userMap[msg.senderId]?.username || msg.senderId,
      senderPhoto: userMap[msg.senderId]?.profilePic || null,
    }));
    console.log('Fetching messages for Private chat:', enriched);
    res.json(enriched);
  } catch (err) {
    console.error('Private message fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch private messages' });
  }
});

// ✅ Room chat messages
router.get('/room/:id', clerkAuth, async (req, res) => {
  const { id } = req.params;
  console.log('Fetching messages for roomId:', id);

  try {
    const messages = await Message.find({ roomId: id })
      .sort({ createdAt: 1 })
      .lean();

    const userIds = [...new Set(messages.map(msg => msg.senderId))];
    const users = await User.find({ clerkId: { $in: userIds } }).lean();
    const userMap = Object.fromEntries(users.map(user => [user.clerkId, user.username]));

    const room = await Room.findById(id).lean();

    const enriched = messages.map(msg => ({
      ...msg,
      senderName: userMap[msg.senderId] || msg.senderId || 'Unknown',
      roomName: room?.name || 'Room',
    }));

    console.log('✅ Room messages count:', enriched.length);
    res.json(enriched);
  } catch (error) {
    console.error('Room message fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch room messages' });
  }
});

module.exports = router;

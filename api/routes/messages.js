const router = require('express').Router();
const Message = require('../models/Message');
const User = require('../models/User'); // Import User model to fetch usernames
const Room = require('../models/Room'); // Import Room model to fetch room names
const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");
require('dotenv').config();

// ✅ Clerk middleware
const clerkAuth = ClerkExpressRequireAuth();

// ✅ Private messages between two users
router.get('/private/:id', clerkAuth, async (req, res) => {
  const { id } = req.params; // ID of the other user
  const myId = req.auth.userId;

  try {
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: id },
        { senderId: id, receiverId: myId }
      ],
      roomId: { $exists: false },
    })
      .sort({ createdAt: 1 })
      .lean();

    // Get usernames for sender and receiver
    const userIds = [...new Set(messages.map(msg => msg.senderId))];
    const users = await User.find({ clerkId: { $in: userIds } }).lean();
    const userMap = Object.fromEntries(users.map(user => [user.clerkId, user.username]));

    const enriched = messages.map(msg => ({
      ...msg,
      senderName: userMap[msg.senderId] || 'Unknown',
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Private message fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch private messages' });
  }
});

// ✅ Messages in a group room
router.get('/room/:id', clerkAuth, async (req, res) => {
  const { id } = req.params;

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
      senderName: userMap[msg.senderId] || 'Unknown',
      roomName: room?.name || 'Room',
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Room message fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch room messages' });
  }
});

module.exports = router;

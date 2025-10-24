const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");
require('dotenv').config();
const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');
// ✅ Call the Clerk middleware to get a handler function
const clerkAuth = ClerkExpressRequireAuth();

// GET /api/chats
router.get('/list',clerkAuth, async (req, res) => {

  console.log('$$$$..process.env',process.env.CLERK_SECRET_KEY);
  

   const myId = req.auth.userId;

   console.log('called profile..myID',myId);
    try {
    // ✅ 1️⃣ 1-to-1 chats
    const oneToOne = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: myId },
            { receiverId: myId }
          ],
          roomId: { $exists: false }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            user: {
              $cond: [
                { $eq: ["$senderId", myId] },
                "$receiverId",
                "$senderId"
              ]
            }
          },
          lastMessage: { $first: "$$ROOT" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.user",
          foreignField: "clerkId",
          as: "contact"
        }
      },
      { $unwind: "$contact" },
      {
        $project: {
          _id: 0,
          userId: "$_id.user",          
          lastMessageText: "$lastMessage.text",
          lastMessageTime: "$lastMessage.createdAt",
          receiverId:"$lastMessage.receiverId",
          contactName: "$contact.name",
          phoneNumber:"$contact.phoneNumber",
          contactPhoto: "$contact.photoUrl",
          contactStatus: "$contact.status"
        }
      }
    ]);

    // ✅ 2️⃣ Rooms
    const rooms = await Message.aggregate([
      {
        $match: {
          roomId: { $exists: true }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$roomId",
          lastMessage: { $first: "$$ROOT" }
        }
      },
      {
        $lookup: {
          from: "rooms",
          localField: "_id",
          foreignField: "_id",
          as: "room"
        }
      },
      { $unwind: "$room" },
      {
        $project: {
          _id: 0,
          roomId: "$_id",
          lastMessageText: "$lastMessage.text",
          lastMessageTime: "$lastMessage.createdAt",
          photoUrl:"$room.roomPic",
          roomName: "$room.name",
          roomMembers: "$room.members"
        }
      }
    ]);
   console.error('oneToOne and rooms',oneToOne);
    res.json({ oneToOne, rooms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

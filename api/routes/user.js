const express = require("express");
const router = express.Router();
const User = require("../models/User");
require('dotenv').config();
const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");

const clerkAuth = ClerkExpressRequireAuth();

// ✅ Create or update user profile
router.post("/profile", clerkAuth, async (req, res) => {
  const clerkId = req.auth.userId;
  const { username, status, profilePic, phoneNumber } = req.body;

  try {
    let user = await User.findOne({ clerkId });

    if (!user) {
      user = await User.create({ clerkId, username, status, profilePic, phoneNumber });
    } else {
      user.username = username || user.username;
      user.status = status || user.status;
      user.phoneNumber = phoneNumber || user.phoneNumber;  // ✅ Fixed typo here
      user.profilePic = profilePic || user.profilePic;
      await user.save();
    }

    res.json(user);
  } catch (err) {
    console.error("Profile save error:", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// ✅ Get logged-in user's profile
router.get("/profile", clerkAuth, async (req, res) => {
  try {
    const user = await User.findOne({ clerkId: req.auth.userId });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findOne({ clerkId: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });

    console.log('✅ res-user', user);

    res.json(user);
  } catch (err) {
    console.error("❌ Error in /api/users/:id", err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
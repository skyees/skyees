// routes/calls.js
const express = require('express');
const router = express.Router();
const Call = require('../models/Call');
const User = require('../models/User');

module.exports = () => {
  // Create a new call record and notify receiver
  router.post('/', async (req, res) => {
    console.log('📞 POST /api/calls hit - body:', req.body);
    const { callerId, receiverId, callType } = req.body;
    if (!callerId || !receiverId) return res.status(400).json({ message: 'callerId and receiverId are required' });

    try {
      const newCall = await Call.create({
        callerId,
        receiverId,
        callType: callType || 'audio',
        status: 'ringing',
        startedAt: new Date(),
        duration: 0,
      });
      console.log('✅ Call record created:', newCall._id);

      const callerProfile = await User.findOne({ clerkId: callerId }).lean();
      const payload = {
        ...newCall.toObject(),
        callerName: callerProfile?.username || 'Unknown Caller',
        callerImg: callerProfile?.profilePic || null,
      };

      const onlineUsers = req.app.get('onlineUsers');
      const ioInstance = req.app.get('io');
      const receiverSocketId = onlineUsers.get(receiverId);

      console.log('ℹ️ onlineUsers size:', onlineUsers?.size, 'receiverSocketId:', receiverSocketId);
      if (receiverSocketId && ioInstance) {
        ioInstance.to(receiverSocketId).emit('incoming-call', payload);
        console.log('📤 Emitted incoming-call to receiver socket');
      } else {
        console.log(`⚠️ Receiver ${receiverId} not online`);
      }

      return res.status(201).json(newCall);
    } catch (err) {
      console.error('❌ Error creating call:', err.stack || err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Accept a call: mark accepted, notify caller AND signal caller that receiver is ready
  router.put('/accept', async (req, res) => {
    console.log('📥 PUT /api/calls/accept body:', req.body);
    try {
      const { callId } = req.body;
      if (!callId) return res.status(400).json({ message: 'callId is required' });

      const call = await Call.findById(callId);
      if (!call) return res.status(404).json({ message: 'Call not found' });

      call.status = 'accepted';         // matches your Call schema enum
      call.answeredAt = new Date();
      await call.save();

      const ioInstance = req.app.get('io');
      const onlineUsers = req.app.get('onlineUsers');
      const callerSocketId = onlineUsers.get(call.callerId);

      if (callerSocketId && ioInstance) {
        // 1) Tell the caller the call was accepted (UI update)
        ioInstance.to(callerSocketId).emit('call-accepted', call.toObject());
        // 2) Tell the caller that the receiver is ready to negotiate (so caller can create offer)
        ioInstance.to(callerSocketId).emit('receiver-ready', { callId, from: call.receiverId });
        console.log('📤 Emitted call-accepted and receiver-ready to caller socket');
      } else {
        console.warn('⚠️ accept: caller not online or io missing');
      }

      return res.status(200).json(call);
    } catch (err) {
      console.error('❌ SERVER ERROR: /api/calls/accept:', err.stack || err.message);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // End/missed
  router.put('/end', async (req, res) => {
    console.log('📥 PUT /api/calls/end body:', req.body);
    try {
      const { callId, status } = req.body;
      if (!callId || !status) return res.status(400).json({ message: 'callId and status are required' });

      const call = await Call.findById(callId);
      if (!call) return res.status(404).json({ message: 'Call not found' });

      const duration = call.status === 'accepted' && status === 'ended'
        ? Math.floor((Date.now() - new Date(call.answeredAt || call.startedAt).getTime())/1000)
        : 0;

      call.status = status;
      call.duration = duration;
      call.endedAt = new Date();
      await call.save();

      const updated = call.toObject();
      const ioInstance = req.app.get('io');
      const onlineUsers = req.app.get('onlineUsers');

      const callerSocket = onlineUsers.get(updated.callerId);
      const receiverSocket = onlineUsers.get(updated.receiverId);
      console.log('ℹ️ callerSocket, receiverSocket', callerSocket, receiverSocket);

      if (callerSocket) ioInstance.to(callerSocket).emit('call-ended', updated);
      if (receiverSocket) ioInstance.to(receiverSocket).emit('call-ended', updated);

      if (status === 'missed' && callerSocket) {
        ioInstance.to(callerSocket).emit('call-declined', { callId });
      }

      return res.status(200).json(updated);
    } catch (err) {
      console.error('❌ SERVER ERROR /api/calls/end:', err.stack || err.message);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // Get calls for user
  router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log('📥 GET /api/calls/:userId', userId);
    try {
      const calls = await Call.find({
        $or: [{ callerId: userId }, { receiverId: userId }]
      }).sort({ createdAt: -1 }).lean();
      console.log('ℹ️ calls found:', calls?.length);
      return res.json(calls);
    } catch (err) {
      console.error('❌ Error fetching calls:', err);
      return res.status(500).json({ message: 'Server error fetching calls' });
    }
  });

  return router;
};

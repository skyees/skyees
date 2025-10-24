const express = require("express");
const router = express.Router();
const Call = require("../models/Call");

module.exports=(io)=>{

router.post("/", async (req, res) => {
         try {
           const call = new Call(req.body);
           await call.save();

           // notify receiver (emit to room `user_<id>` if you use socket.join)
           io.to(`user_${call.receiverId}`).emit('incoming-call', call);

           // server-side missed timeout: mark missed if not accepted in 30s
           setTimeout(async () => {
             const fresh = await Call.findById(call._id);
             if (fresh && fresh.status === 'ringing') {
               fresh.status = 'missed';
               await fresh.save();
               io.to(`user_${fresh.callerId}`).emit('call-updated', fresh);
               io.to(`user_${fresh.receiverId}`).emit('call-updated', fresh);
             }
           }, 30_000);

           res.status(201).json(call);
         } catch (err) {
           console.error(err);
           res.status(500).json({ error: 'Failed to create call' });
         }
        });

// Get all calls for a user
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const calls = await Call.find({
      $or: [{ callerId: userId }, { receiverId: userId }],
    }).sort({ startedAt: -1 });
    res.json(calls);
  } catch (err) {
    console.error("Error fetching calls:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

  // Update call (accept/reject/end)
  router.put('/:id', async (req, res) => {
    try {
      const updated = await Call.findByIdAndUpdate(req.params.id, req.body, { new: true });
      // broadcast update
      io.to(`user_${updated.callerId}`).emit('call-updated', updated);
      io.to(`user_${updated.receiverId}`).emit('call-updated', updated);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update call' });
    }
  });

 return router;
}
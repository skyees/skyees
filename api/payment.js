const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize with your keys
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Initiate Order
router.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body; // In paise (e.g. 50000 for ₹500)
    
    const options = {
      amount: amount,
      currency: "INR",
      receipt: "rcpt_" + Math.floor(Math.random() * 1000000),
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    res.status(500).json({ error: "Failed to create Razorpay order" });
  }
});

// 2. Verify Signature (Crucial for security)
router.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
  const generated_signature = hmac.digest("hex");

  if (generated_signature === razorpay_signature) {
    // ✅ Payment Verified
    // You can now update the user's order status in your DB
    res.status(200).json({ success: true, message: "Payment verified successfully" });
  } else {
    // ❌ Tampered Payment
    res.status(400).json({ success: false, message: "Invalid payment signature" });
  }
});

module.exports = router;
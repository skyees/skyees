const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderName: { type: String, required: true, default: 'Unknown' },
  senderId: { type: String, required: true },
  receiverId: { type: String },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  text: { type: String, default: '' },
  image: { type: String, default: '' },
  audio: { type: String, default: '' },
  video: { type: String, default: '' },
  phoneNumber: { type: String },
}, {
  timestamps: true
});

module.exports = mongoose.model("Message", messageSchema);

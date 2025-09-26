const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  roomId: {type:mongoose.Schema.Types.ObjectId,ref:'Room'},
  text: String,
  image: { type: String },
  audio: { type: String },
  video: { type: String },
  phoneNumber: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
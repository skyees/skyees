const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  clientId: { type: String, index: true }, // <-- ties client optimistic msg to server msg
  text: { type: String, default: "" },
  image: String,
  audio: String,
  video: String,

  senderId: { type: String, required: true },
  receiverId: String,
  roomId: String,

  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },

  createdAt: { type: Date, default: Date.now },
  edited: { type: Boolean, default: false },
});

module.exports = mongoose.model("Message", MessageSchema);

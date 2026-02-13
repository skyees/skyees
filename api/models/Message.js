const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },   // Clerk/user ID
  emoji: { type: String, required: true },    // "❤️" | "👍" | "😂" | "😮" | "😢" | "🙏"
  reactedAt: { type: Date, default: Date.now }
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  clientId: { type: String, index: true }, // ties client optimistic msg to server msg
  text: { type: String, default: "" },
  image: String,
  audio: String,
  video: String,

  senderId: { type: String, required: true },
  receiverId: String,
  roomId: String,
  status: {
    type: String,
    enum: ["sending","sent","delivered","seen"],
    default: "sent"
  },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },

  createdAt: { type: Date, default: Date.now },
  edited: { type: Boolean, default: false },

  // ✅ new field for reactions
  reactions: { type: [reactionSchema], default: [] }
});

module.exports = mongoose.model("Message", MessageSchema);


const Mongoose = require('mongoose');

const ChatSchema = new Mongoose.Schema({
isGroup:{type:Boolean,default:false},
 participants: [{ type: Mongoose.Schema.Types.ObjectId, ref: "User" }],
  name: String, // For group chats only
  createdAt: { type: Date, default: Date.now },
})

module.exports = Mongoose.model('Chat',ChatSchema);
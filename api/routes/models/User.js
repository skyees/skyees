const Mongoose = require('mongoose');

const UserSchema = new Mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  username: String,
  status: String,
  profilePic: String,
  phoneNumber: String,
  createdAt:{type:Date,default:Date.now}
});

module.exports = Mongoose.model('User',UserSchema);
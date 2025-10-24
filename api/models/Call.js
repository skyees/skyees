// models/Call.js
const mongoose = require('mongoose');
const CallSchema = new mongoose.Schema({
  callerId: { type: String, required: true },
  receiverId: { type: String, required: true },
  callerName: String,
  receiverName: String,
  callerImg: String,
  receiverImg: String,
  callType: { type: String, enum: ['audio','video'], default: 'audio' },
  status: { type: String, enum: ['ringing','accepted','rejected','missed','ended'], default: 'ringing' },
  startedAt: { type: Date, default: Date.now },
  answeredAt: Date,
  endedAt: Date,
  duration: Number
});
module.exports = mongoose.model('Call', CallSchema);
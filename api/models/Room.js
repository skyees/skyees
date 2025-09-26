const Mongoose = require('mongoose');

const RoomSchema = new Mongoose.Schema({
    name:{type:String,required:true},
    members:[{type:Mongoose.Schema.Types.ObjectId,ref:'User'}],
    createdAt:{type:Date,default:Date.now}
    
})

module.exports = Mongoose.model('Room',RoomSchema);
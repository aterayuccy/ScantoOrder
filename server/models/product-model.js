const mongoose=require('mongoose');
const {Schema}=mongoose;

const courseSchema=new Schema({
    id : {type: String},
    title:{
        type: String,
        required: true
    },
    description:{
        type: String,
        default: ""
    },
    price:{
        type:Number,
        required: true
    },
    seller:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },   
    buyer: [
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        quantity: { type: Number, default: 1 },
        tableNumber: { type: Number, default: null },
        submittedAt: { type: Date, default: null },
    },
    ],
    type:{
        type: String,
        required: true
    },
    image: {
  type: String,
  default: "",
}
});


module.exports=mongoose.model('Product',courseSchema);

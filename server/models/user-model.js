const mongoose=require('mongoose');
const {Schema}=mongoose;
const bcrypt=require('bcrypt');

const userSchema=new Schema({
    username:{
        type:String,
        required:true,
        minlength:3,
        maxlength:50
    },
    email:{
        type:String,
        required:true,
        minlength:6,
        maxlength:50
    },
    password:{
        type:String,
        required:true
    },
    role:{
        type:String,
        enum:["buyer","seller"],
        required:true
    },
    tableNumber: {
        type: Number,
        default: null
    },
    qrSeller: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    // date:{
    //     type:Date,
    //     default:Date.now
    // }
})


userSchema.methods.isBuyer= function(){
    return this.role==="buyer";
}

userSchema.methods.isSeller= function(){
    return this.role==="seller";
}

userSchema.methods.comparePassword=async function(password,cb){
    let result;
    try {
        result=await bcrypt.compare(password,this.password);
        return cb(null,result); 
    } catch (e) {
        return cb(e,result); 
    }
       
};


userSchema.pre('save',async function (next) {

    if(this.isNew || this.isModified('password')){
        const hashValue=await bcrypt.hash(this.password,10);
        this.password=hashValue;
    }
    next();
});


module.exports=mongoose.model('User',userSchema);


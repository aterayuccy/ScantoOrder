const mongoose=require('mongoose');
const {Schema}=mongoose;
const bcrypt=require('bcrypt');

const userSchema=new Schema({
    username:{
        type:String,
        required:true,
        trim:true,
        minlength:3,
        maxlength:20,
        match:/^[A-Za-z0-9_]+$/
    },
    password:{
        type:String,
        required:true,
        minlength:8,
        maxlength:64,
        match:/^[\x20-\x7E]+$/,
        select:false
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
}, {
    timestamps:true,
})

userSchema.index(
    {username:1},
    {
        unique:true,
        collation:{locale:"en",strength:2}
    }
);


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


const express= require('express');
const app=express();
const mongoose=require('mongoose');
const dotenv=require('dotenv');
const path=require('path');
dotenv.config({ path: path.join(__dirname, ".env") });
const authRoute=require('./routes').auth;
const productRoute=require('./routes').product;
const passport=require('passport');
require('./config/passport')(passport);
app.use(passport.initialize());
const cors = require('cors');

mongoose
    .connect("mongodb://localhost:27017/mernDB")
    .then(()=>{
        console.log("連結到MongoDB")
    })
    .catch((e) =>{
        console.log(e);
    } )


app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors());

app.use('/api/user',authRoute);

app.use('/uploads', express.static('uploads'));
app.use(
    '/api/product'/*,
    passport.authenticate('jwt', { session: false })*/
    ,productRoute)

app.listen(8080,()=>{
    console.log("後端伺服器聆聽在port 8080...")
})

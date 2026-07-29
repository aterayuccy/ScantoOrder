const express= require('express');
const app=express();
const mongoose=require('mongoose');
const dotenv=require('dotenv');
const fs=require('fs');
const path=require('path');
dotenv.config({ path: path.join(__dirname, ".env") });
const authRoute=require('./routes').auth;
const productRoute=require('./routes').product;
const paymentRoute=require('./routes').payment;
const User=require('./models/user-model');
const Payment=require('./models/payment-model');
const uploadsDirectory=require('./uploads');
const passport=require('passport');
require('./config/passport')(passport);
app.use(passport.initialize());
const cors = require('cors');
const port = Number(process.env.PORT || 8080);
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);

if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set("trust proxy", trustProxyHops);
}

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors());

app.use('/api/user',authRoute);

app.get('/health', (req, res) => {
    res.status(200).send({
        status: "healthy",
        uptime: process.uptime(),
    });
});

app.use('/uploads', express.static(uploadsDirectory));
app.use(
    '/api/product'/*,
    passport.authenticate('jwt', { session: false })*/
    ,productRoute)
app.use('/api/payment', paymentRoute);

const clientBuildPath = path.join(__dirname, "..", "client", "build");
const clientIndexPath = path.join(clientBuildPath, "index.html");

if (fs.existsSync(clientIndexPath)) {
    app.use(express.static(clientBuildPath));
    app.use((req, res, next) => {
        if (req.method !== "GET" || req.path.startsWith("/api/")) {
            return next();
        }
        return res.sendFile(clientIndexPath);
    });
}

const startServer = async () => {
    try {
        await mongoose.connect(
            process.env.MONGODB_URI || "mongodb://localhost:27017/mernDB"
        );
        await User.init();
        await Payment.init();
        console.log("連結到MongoDB");

        app.listen(port,()=>{
            console.log(`後端伺服器聆聽在port ${port}...`);
        });
    } catch (error) {
        console.error("後端啟動失敗：", error);
        process.exitCode = 1;
    }
};

startServer();

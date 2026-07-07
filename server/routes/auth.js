const router = require("express").Router();
const registerValidation = require("../validation").registerValidation;
const loginValidation = require("../validation").loginValidation;
const User = require("../models/user-model");
const QrCode = require("../models").qrCode;
const jwt=require("jsonwebtoken");
const passport = require("passport");
const crypto = require("crypto");


router.use((req,res,next)=>{
    console.log("正在接收一個有關auth的請求");
    next();
});

router.get("/testAPI",(req,res) =>{
    return res.send("成功連結auth route...");
});

router.post("/register", async(req,res) =>{

    const registerData = {
        ...req.body,
        role: "seller",
    };

    let {error}=registerValidation(registerData);
    if (error) return res.status(400).send(error.details[0].message);


    const emailExist = await User.findOne({email:registerData.email});
    if (emailExist) return res.status(400).send("此信箱已經被註冊過了");


    let {email,username,password,role}=registerData;
    let newUser=new User({email,username,password,role});
    try {
        let savedUser=await newUser.save();
        return res.send({
            msg:"使用者成功儲存",
            savedUser
        });
    } catch (e) {
        return res.status(500).send("無法儲存使用者");        
    }
})

router.post("/login", async(req,res) =>{

    let {error}=loginValidation(req.body);
    if (error) return res.status(400).send(error.details[0].message);


    const foundUser = await User.findOne({email:req.body.email});
    if (!foundUser) {
        return res.status(401).send("無法找到使用者，請確認信箱是否正確");
    }

    foundUser.comparePassword(req.body.password, async (err,isMatch)=>{
        if (err) return res.status(500).send(err);

        if (isMatch) {
            try {
                if (foundUser.role !== "seller") {
                    foundUser.role = "seller";
                    foundUser.tableNumber = null;
                    foundUser.qrSeller = null;
                    await foundUser.save();
                }

            const tokenObject={_id:foundUser._id,email:foundUser.email};
            const token=jwt.sign(tokenObject,process.env.PASSPORT_SECRET);
            return res.send({
                message:"登入成功",
                token:token,
                user:foundUser
            });
            } catch (e) {
                return res.status(500).send(e);
            }
        }
        else {
            return res.status(401).send("密碼錯誤");
        }

    })
    
})


router.patch("/updateRole", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const { role } = req.body;
    

    if (!["buyer", "seller"].includes(role)) {
        return res.status(400).send("無效的角色");
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { role },
            { new: true }
        ).select("-password");

        res.send({
            message: "角色更新成功",
            user: updatedUser,
        });
    } catch (e) {
        res.status(500).send("角色更新失敗");
    }
});

router.get(
  "/qr-codes",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      if (req.user.role !== "seller") {
        return res.status(403).send("只有店家可以查看 QR code");
      }

      const qrCodes = await QrCode.find({ seller: req.user._id })
        .sort({ tableNumber: 1 })
        .exec();

      return res.send({ qrCodes });
    } catch (e) {
      console.log(e);
      return res.status(500).send("取得 QR code 失敗");
    }
  }
);

router.post(
  "/create-qr-token",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      if (req.user.role !== "seller") {
        return res.status(403).send("只有店家可以產生 QR code");
      }

      const count = Number(req.body.count);

      if (!Number.isInteger(count) || count < 1) {
        return res.status(400).send("請輸入正確的 QR code 生成數量");
      }

      const lastQrCode = await QrCode.findOne({ seller: req.user._id })
        .sort({ tableNumber: -1 })
        .exec();
      const startTableNumber = lastQrCode ? lastQrCode.tableNumber + 1 : 1;

      const qrCodesToCreate = Array.from({ length: count }, (_, index) => ({
        seller: req.user._id,
        tableNumber: startTableNumber + index,
        token: crypto.randomBytes(32).toString("hex"),
      }));

      await QrCode.insertMany(qrCodesToCreate);

      const qrCodes = await QrCode.find({ seller: req.user._id })
        .sort({ tableNumber: 1 })
        .exec();

      return res.send({ qrCodes });
    } catch (e) {
      console.log(e);
      return res.status(500).send("產生 QR code 失敗");
    }
  }
);

router.delete(
  "/qr-codes/:qrCodeId",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      if (req.user.role !== "seller") {
        return res.status(403).send("只有店家可以刪除 QR code");
      }

      const qrCode = await QrCode.findOne({
        _id: req.params.qrCodeId,
        seller: req.user._id,
      }).exec();

      if (!qrCode) {
        return res.status(404).send("找不到 QR code");
      }

      const deletedTableNumber = qrCode.tableNumber;

      await QrCode.deleteOne({ _id: qrCode._id });

      const followingQrCodes = await QrCode.find({
        seller: req.user._id,
        tableNumber: { $gt: deletedTableNumber },
      })
        .sort({ tableNumber: 1 })
        .exec();

      for (const followingQrCode of followingQrCodes) {
        followingQrCode.tableNumber -= 1;
        await followingQrCode.save();
      }

      const qrCodes = await QrCode.find({ seller: req.user._id })
        .sort({ tableNumber: 1 })
        .exec();

      return res.send({ qrCodes });
    } catch (e) {
      console.log(e);
      return res.status(500).send("刪除 QR code 失敗");
    }
  }
);


router.post("/qr-login", async (req, res) => {
  const { qrToken } = req.body;

  if (!qrToken) {
    return res.status(400).send("缺少 qrToken");
  }

  try {
    const record = await QrCode.findOne({ token: qrToken }).exec();

    if (!record) {
      return res.status(400).send("無效的 QR code");
    }

    const guestEmail = `guest_${Date.now()}@guest.com`;
    const guestName = `guest_${Date.now()}`;

    let guestUser = new User({
      email: guestEmail,
      username: guestName,
      password: "12345678",
      role: "buyer",
      tableNumber: record.tableNumber,
      qrSeller: record.seller,
    });

    guestUser = await guestUser.save();

    const tokenObject = { _id: guestUser._id, email: guestUser.email };
    const buyerToken = jwt.sign(tokenObject, process.env.PASSPORT_SECRET);

    return res.send({
      message: "QR 登入成功",
      token: buyerToken,
      user: guestUser,
      sellerId: record.seller,
      tableNumber: record.tableNumber,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send("QR 登入失敗");
  }
});

module.exports = router;

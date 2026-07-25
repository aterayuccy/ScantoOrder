const router = require("express").Router();
const registerValidation = require("../validation").registerValidation;
const loginValidation = require("../validation").loginValidation;
const User = require("../models/user-model");
const QrCode = require("../models").qrCode;
const jwt=require("jsonwebtoken");
const passport = require("passport");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const LOGIN_ATTEMPT_LIMIT = 5;
const IP_LOGIN_ATTEMPT_LIMIT = 25;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_VERSION = Number(process.env.AUTH_VERSION || 1);
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("invalid-password-placeholder-123", 10);
const loginAttempts = new Map();
const ipLoginAttempts = new Map();
let lastLoginAttemptCleanupAt = 0;

const toPublicUser = (user) => {
  const publicUser = user.toObject ? user.toObject() : { ...user };
  delete publicUser.password;
  delete publicUser.email;
  delete publicUser.__v;
  return publicUser;
};

const signUserToken = (user) =>
  jwt.sign(
    { _id: user._id, username: user.username, authVersion: AUTH_VERSION },
    process.env.PASSPORT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );

const getLoginAttemptKey = (req, username) => {
  return `${getLoginIpAddress(req)}:${username.toLowerCase()}`;
};

const getLoginIpAddress = (req) =>
  req.ip || req.socket?.remoteAddress || "unknown";

const getActiveLoginAttempts = (attemptStore, key) => {
  const attempt = attemptStore.get(key);

  if (!attempt) {
    return 0;
  }

  if (Date.now() - attempt.startedAt >= LOGIN_ATTEMPT_WINDOW_MS) {
    attemptStore.delete(key);
    return 0;
  }

  return attempt.count;
};

const recordLoginFailure = (attemptStore, key, maximumEntries) => {
  const currentCount = getActiveLoginAttempts(attemptStore, key);
  const existingAttempt = attemptStore.get(key);

  if (!existingAttempt && attemptStore.size >= maximumEntries) {
    const oldestKey = attemptStore.keys().next().value;
    attemptStore.delete(oldestKey);
  }

  attemptStore.set(key, {
    count: currentCount + 1,
    startedAt: existingAttempt?.startedAt || Date.now(),
  });
};

const cleanupExpiredLoginAttempts = () => {
  const now = Date.now();

  if (now - lastLoginAttemptCleanupAt < 60 * 1000) {
    return;
  }

  [loginAttempts, ipLoginAttempts].forEach((attemptStore) => {
    for (const [key, attempt] of attemptStore.entries()) {
      if (now - attempt.startedAt >= LOGIN_ATTEMPT_WINDOW_MS) {
        attemptStore.delete(key);
      }
    }
  });

  lastLoginAttemptCleanupAt = now;
};

const recordFailedLoginForRequest = (loginAttemptKey, ipAddress) => {
  recordLoginFailure(loginAttempts, loginAttemptKey, 5000);
  recordLoginFailure(ipLoginAttempts, ipAddress, 1000);
};


router.use((req,res,next)=>{
    console.log("正在接收一個有關auth的請求");
    next();
});

router.get("/testAPI",(req,res) =>{
    return res.send("成功連結auth route...");
});

router.post("/register", async(req,res) =>{

    const registerData = {
        username: req.body.username,
        password: req.body.password,
        role: "seller",
    };

    const {error, value}=registerValidation(registerData);
    if (error) return res.status(400).send(error.details[0].message);

    try {
        const {username,password,role}=value;

        if (username.toLowerCase().startsWith("guest_")) {
            return res.status(400).send("此使用者名稱為系統保留");
        }

        const usernameExists = await User.findOne({username})
          .collation({locale:"en",strength:2})
          .lean();

        if (usernameExists) {
            return res.status(409).send("此使用者名稱已被使用");
        }

        const newUser=new User({username,password,role});
        let savedUser=await newUser.save();
        return res.status(201).send({
            msg:"使用者成功儲存",
            user:toPublicUser(savedUser)
        });
    } catch (e) {
        if (e?.code === 11000) {
            return res.status(409).send("此使用者名稱已被使用");
        }

        console.log("register error:", e);
        return res.status(500).send("無法儲存使用者");        
    }
})

router.post("/login", async(req,res) =>{

    const {error, value}=loginValidation(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const {username, password} = value;
    cleanupExpiredLoginAttempts();
    const loginAttemptKey = getLoginAttemptKey(req, username);
    const ipAddress = getLoginIpAddress(req);

    if (
        getActiveLoginAttempts(loginAttempts, loginAttemptKey) >= LOGIN_ATTEMPT_LIMIT ||
        getActiveLoginAttempts(ipLoginAttempts, ipAddress) >= IP_LOGIN_ATTEMPT_LIMIT
    ) {
        return res.status(429).send("登入嘗試次數過多，請於 15 分鐘後再試");
    }

    const foundUser = await User.findOne({username})
      .collation({locale:"en",strength:2})
      .select("+password");
    if (!foundUser) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        recordFailedLoginForRequest(loginAttemptKey, ipAddress);
        return res.status(401).send("使用者名稱或密碼錯誤");
    }

    foundUser.comparePassword(password, async (err,isMatch)=>{
        if (err) return res.status(500).send(err);

        if (isMatch) {
            try {
                if (foundUser.role !== "seller") {
                    recordFailedLoginForRequest(loginAttemptKey, ipAddress);
                    return res.status(401).send("使用者名稱或密碼錯誤");
                }

            loginAttempts.delete(loginAttemptKey);
            const token=signUserToken(foundUser);
            return res.send({
                message:"登入成功",
                token:token,
                authVersion:AUTH_VERSION,
                user:toPublicUser(foundUser)
            });
            } catch (e) {
                return res.status(500).send(e);
            }
        }
        else {
            recordFailedLoginForRequest(loginAttemptKey, ipAddress);
            return res.status(401).send("使用者名稱或密碼錯誤");
        }

    })
    
})


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

    const guestName = `guest_${crypto.randomBytes(6).toString("hex")}`;
    const guestPassword = `${crypto.randomBytes(16).toString("hex")}A1`;

    let guestUser = new User({
      username: guestName,
      password: guestPassword,
      role: "buyer",
      tableNumber: record.tableNumber,
      qrSeller: record.seller,
    });

    guestUser = await guestUser.save();

    const buyerToken = signUserToken(guestUser);

    return res.send({
      message: "QR 登入成功",
      token: buyerToken,
      authVersion: AUTH_VERSION,
      user: toPublicUser(guestUser),
      sellerId: record.seller,
      tableNumber: record.tableNumber,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send("QR 登入失敗");
  }
});

module.exports = router;

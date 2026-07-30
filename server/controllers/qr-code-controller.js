const crypto = require("crypto");

const QrCode = require("../models/qr-code-model");
const {
  AUTH_VERSION,
  signUserToken,
  toPublicUser,
} = require("../services/auth-token-service");
const {
  QrGuestError,
  createOrReuseQrGuest,
} = require("../services/qr-guest-service");

const listQrCodes = async (req, res) => {
  try {
    const qrCodes = await QrCode.find({ seller: req.user._id })
      .sort({ tableNumber: 1 })
      .exec();
    return res.send({ qrCodes });
  } catch (error) {
    console.error("list QR codes error:", error);
    return res.status(500).send("取得 QR code 失敗");
  }
};

const createQrCodes = async (req, res) => {
  try {
    const { count } = req.validatedBody;
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
    return listQrCodes(req, res);
  } catch (error) {
    console.error("create QR codes error:", error);
    return res.status(500).send("產生 QR code 失敗");
  }
};

const deleteQrCode = async (req, res) => {
  try {
    const qrCode = await QrCode.findOne({
      _id: req.params.qrCodeId,
      seller: req.user._id,
    }).exec();

    if (!qrCode) return res.status(404).send("找不到 QR code");

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

    return listQrCodes(req, res);
  } catch (error) {
    console.error("delete QR code error:", error);
    return res.status(500).send("刪除 QR code 失敗");
  }
};

const qrLogin = async (req, res) => {
  try {
    const { guestUser, record, reused } = await createOrReuseQrGuest(
      req.validatedBody
    );

    return res.send({
      message: "QR 登入成功",
      token: signUserToken(guestUser),
      authVersion: AUTH_VERSION,
      user: toPublicUser(guestUser),
      sellerId: record.seller,
      tableNumber: record.tableNumber,
      reused,
    });
  } catch (error) {
    if (error instanceof QrGuestError) {
      return res.status(error.statusCode).send(error.message);
    }
    console.error("QR login error:", error);
    return res.status(500).send("QR 登入失敗");
  }
};

module.exports = {
  createQrCodes,
  deleteQrCode,
  listQrCodes,
  qrLogin,
};

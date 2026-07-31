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
    const { count, mode, tableNumber } = req.validatedBody;
    let tableNumbers;

    if (mode === "specific") {
      const existingQrCode = await QrCode.findOne({
        seller: req.user._id,
        tableNumber,
      }).exec();
      if (existingQrCode) {
        return res.status(409).send(`桌號 ${tableNumber} 已存在`);
      }
      tableNumbers = [tableNumber];
    } else {
      const lastQrCode = await QrCode.findOne({ seller: req.user._id })
        .sort({ tableNumber: -1 })
        .exec();
      const startTableNumber = lastQrCode ? lastQrCode.tableNumber + 1 : 1;
      tableNumbers = Array.from(
        { length: count },
        (_, index) => startTableNumber + index
      );
    }

    const qrCodesToCreate = tableNumbers.map((nextTableNumber) => ({
      seller: req.user._id,
      tableNumber: nextTableNumber,
      token: crypto.randomBytes(32).toString("hex"),
    }));

    await QrCode.insertMany(qrCodesToCreate);
    return listQrCodes(req, res);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).send("這個桌號已存在");
    }
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

    await QrCode.deleteOne({ _id: qrCode._id });

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

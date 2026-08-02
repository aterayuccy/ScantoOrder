const crypto = require("crypto");

const QrCode = require("../models/qr-code-model");
const User = require("../models/user-model");
const { requireActiveSubscription } = require("./subscription-service");

class QrGuestError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "QrGuestError";
    this.statusCode = statusCode;
  }
}

const getGuestTtlMs = (environment = process.env) => {
  const configuredHours = Number(environment.QR_GUEST_TTL_HOURS || 24);
  const hours =
    Number.isFinite(configuredHours) && configuredHours >= 1
      ? Math.min(configuredHours, 168)
      : 24;
  return hours * 60 * 60 * 1000;
};

const buildGuestSessionKey = (qrToken, clientSessionId) => {
  if (!clientSessionId) return "";
  return crypto
    .createHash("sha256")
    .update(`${qrToken}:${clientSessionId}`)
    .digest("hex");
};

const createOrReuseQrGuest = async (
  { qrToken, clientSessionId },
  { now = new Date(), environment = process.env } = {}
) => {
  const record = await QrCode.findOne({ token: qrToken }).exec();
  if (!record) throw new QrGuestError("無效的 QR code");
  try {
    await requireActiveSubscription(record.seller, now);
  } catch (error) {
    if (error.code === "SUBSCRIPTION_SUSPENDED") {
      throw new QrGuestError("店家目前暫停提供線上點餐", 403);
    }
    throw error;
  }

  const expiresAt = new Date(now.getTime() + getGuestTtlMs(environment));
  const guestSessionKey = buildGuestSessionKey(qrToken, clientSessionId);
  let guestUser = null;

  if (guestSessionKey) {
    guestUser = await User.findOne({
      guestSessionKey,
      role: "buyer",
      guestExpiresAt: { $gt: now },
    }).exec();
  }

  if (guestUser) {
    guestUser.tableNumber = record.tableNumber;
    guestUser.qrSeller = record.seller;
    guestUser.lastSeenAt = now;
    guestUser.guestExpiresAt = expiresAt;
    await guestUser.save();
    return { guestUser, record, reused: true };
  }

  const guestName = `guest_${crypto.randomBytes(6).toString("hex")}`;
  const guestPassword = `${crypto.randomBytes(16).toString("hex")}A1`;

  try {
    guestUser = await User.create({
      username: guestName,
      password: guestPassword,
      role: "buyer",
      tableNumber: record.tableNumber,
      qrSeller: record.seller,
      guestSessionKey: guestSessionKey || undefined,
      guestExpiresAt: expiresAt,
      lastSeenAt: now,
    });
  } catch (error) {
    if (error?.code !== 11000 || !guestSessionKey) throw error;

    guestUser = await User.findOne({ guestSessionKey }).exec();
    if (!guestUser) throw error;
    guestUser.tableNumber = record.tableNumber;
    guestUser.qrSeller = record.seller;
    guestUser.lastSeenAt = now;
    guestUser.guestExpiresAt = expiresAt;
    await guestUser.save();
    return { guestUser, record, reused: true };
  }

  return { guestUser, record, reused: false };
};

module.exports = {
  QrGuestError,
  buildGuestSessionKey,
  createOrReuseQrGuest,
  getGuestTtlMs,
};

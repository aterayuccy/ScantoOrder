const jwt = require("jsonwebtoken");

const AUTH_VERSION = Number(process.env.AUTH_VERSION || 1);

const toPublicUser = (user) => {
  const publicUser = user.toObject ? user.toObject() : { ...user };
  delete publicUser.password;
  delete publicUser.email;
  delete publicUser.guestSessionKey;
  delete publicUser.guestExpiresAt;
  delete publicUser.lastSeenAt;
  delete publicUser.recoveryCodeHash;
  delete publicUser.recoveryCodeCreatedAt;
  delete publicUser.paymentQrImagePublicId;
  delete publicUser.__v;
  return publicUser;
};

const signUserToken = (user) =>
  jwt.sign(
    {
      _id: user._id,
      username: user.username,
      authVersion: AUTH_VERSION,
      tokenVersion: Number(user.tokenVersion || 1),
    },
    process.env.PASSPORT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );

module.exports = {
  AUTH_VERSION,
  signUserToken,
  toPublicUser,
};

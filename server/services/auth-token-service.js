const jwt = require("jsonwebtoken");

const AUTH_VERSION = Number(process.env.AUTH_VERSION || 1);

const toPublicUser = (user) => {
  const publicUser = user.toObject ? user.toObject() : { ...user };
  delete publicUser.password;
  delete publicUser.email;
  delete publicUser.guestSessionKey;
  delete publicUser.guestExpiresAt;
  delete publicUser.lastSeenAt;
  delete publicUser.__v;
  return publicUser;
};

const signUserToken = (user) =>
  jwt.sign(
    { _id: user._id, username: user.username, authVersion: AUTH_VERSION },
    process.env.PASSPORT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );

module.exports = {
  AUTH_VERSION,
  signUserToken,
  toPublicUser,
};

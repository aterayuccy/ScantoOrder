const bcrypt = require("bcrypt");

const User = require("../models/user-model");
const { normalizeUsername } = require("./username-service");

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "invalid-password-placeholder-123",
  10
);

class AuthenticationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = statusCode;
  }
}

const registerSeller = async ({ username, password }) => {
  const normalizedUsername = normalizeUsername(username);

  if (normalizedUsername.toLowerCase().startsWith("guest_")) {
    throw new AuthenticationError("此使用者名稱為系統保留");
  }

  const usernameExists = await User.findOne({ username: normalizedUsername })
    .collation({ locale: "en", strength: 2 })
    .lean();

  if (usernameExists) {
    throw new AuthenticationError("此使用者名稱已被使用", 409);
  }

  try {
    return await User.create({
      username: normalizedUsername,
      password,
      role: "seller",
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AuthenticationError("此使用者名稱已被使用", 409);
    }
    throw error;
  }
};

const verifySellerCredentials = async ({ username, password }) => {
  const normalizedUsername = normalizeUsername(username);
  const user = await User.findOne({ username: normalizedUsername })
    .collation({ locale: "en", strength: 2 })
    .select("+password");

  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches || user.role !== "seller") return null;
  return user;
};

module.exports = {
  AuthenticationError,
  registerSeller,
  verifySellerCredentials,
};

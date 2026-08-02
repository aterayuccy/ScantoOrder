const bcrypt = require("bcrypt");
const crypto = require("crypto");

const User = require("../models/user-model");
const {
  createInitialSubscriptionFields,
  ensureSellerSubscriptionDocument,
} = require("./subscription-service");
const { normalizeUsername } = require("./username-service");

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "invalid-password-placeholder-123",
  10
);

const generateRecoveryCode = () =>
  crypto.randomBytes(12).toString("hex").toUpperCase();

const hashRecoveryCode = (recoveryCode) =>
  bcrypt.hash(String(recoveryCode), 10);

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
    const now = new Date();
    const recoveryCode = generateRecoveryCode();
    const user = await User.create({
      username: normalizedUsername,
      password,
      role: "seller",
      ...createInitialSubscriptionFields(now),
      recoveryCodeHash: await hashRecoveryCode(recoveryCode),
      recoveryCodeCreatedAt: now,
    });
    return { user, recoveryCode };
  } catch (error) {
    if (error?.code === 11000) {
      throw new AuthenticationError("此使用者名稱已被使用", 409);
    }
    throw error;
  }
};

const changeSellerPassword = async ({
  userId,
  currentPassword,
  newPassword,
}) => {
  const user = await User.findById(userId).select("+password");
  if (!user || user.role !== "seller") {
    throw new AuthenticationError("找不到店家帳號", 404);
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatches) {
    throw new AuthenticationError("目前密碼不正確", 401);
  }

  user.password = newPassword;
  user.tokenVersion = Number(user.tokenVersion || 1) + 1;
  await user.save();
  return user;
};

const resetSellerPassword = async ({ username, recoveryCode, newPassword }) => {
  const normalizedUsername = normalizeUsername(username);
  const user = await User.findOne({ username: normalizedUsername })
    .collation({ locale: "en", strength: 2 })
    .select("+recoveryCodeHash");

  const recoveryMatches =
    user?.recoveryCodeHash &&
    (await bcrypt.compare(
      String(recoveryCode || "")
        .replace(/[\s-]/g, "")
        .toUpperCase(),
      user.recoveryCodeHash
    ));

  if (!user || user.role !== "seller" || !recoveryMatches) {
    throw new AuthenticationError("使用者名稱或救援碼不正確", 401);
  }

  const nextRecoveryCode = generateRecoveryCode();
  user.password = newPassword;
  user.recoveryCodeHash = await hashRecoveryCode(nextRecoveryCode);
  user.recoveryCodeCreatedAt = new Date();
  user.tokenVersion = Number(user.tokenVersion || 1) + 1;
  await user.save();

  return { recoveryCode: nextRecoveryCode };
};

const regenerateSellerRecoveryCode = async (userId, password) => {
  const user = await User.findOne({ _id: userId, role: "seller" }).select(
    "+password +recoveryCodeHash"
  );
  if (!user) throw new AuthenticationError("找不到店家帳號", 404);
  if (!(await bcrypt.compare(password, user.password))) {
    throw new AuthenticationError("密碼不正確", 401);
  }

  const recoveryCode = generateRecoveryCode();
  user.recoveryCodeHash = await hashRecoveryCode(recoveryCode);
  user.recoveryCodeCreatedAt = new Date();
  await user.save();
  return { recoveryCode };
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
  return ensureSellerSubscriptionDocument(user);
};

module.exports = {
  AuthenticationError,
  changeSellerPassword,
  generateRecoveryCode,
  regenerateSellerRecoveryCode,
  registerSeller,
  resetSellerPassword,
  verifySellerCredentials,
};

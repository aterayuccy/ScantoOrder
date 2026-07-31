const {
  AuthenticationError,
  changeSellerPassword,
  regenerateSellerRecoveryCode,
  registerSeller,
  resetSellerPassword,
  verifySellerCredentials,
} = require("../services/auth-service");
const {
  deleteSellerAccount,
  getSellerSettings,
  updateSellerSettings,
} = require("../services/account-service");
const { sameId } = require("../middlewares/authorization");
const {
  AUTH_VERSION,
  signUserToken,
  toPublicUser,
} = require("../services/auth-token-service");
const {
  buildLoginAttemptService,
  LoginAttemptStoreError,
} = require("../services/login-attempt-service");

const loginAttempts = buildLoginAttemptService();

const getIpAddress = (req) => req.ip || req.socket?.remoteAddress || "unknown";

const register = async (req, res) => {
  try {
    const { user, recoveryCode } = await registerSeller(req.validatedBody);
    return res.status(201).send({
      msg: "使用者成功儲存",
      user: toPublicUser(user),
      recoveryCode,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(error.statusCode).send(error.message);
    }
    console.error("register error:", error);
    return res.status(500).send("無法儲存使用者");
  }
};

const changePassword = async (req, res) => {
  try {
    const user = await changeSellerPassword({
      userId: req.user._id,
      ...req.validatedBody,
    });
    return res.send({
      message: "密碼已修改，其他裝置需要重新登入",
      token: signUserToken(user),
      authVersion: AUTH_VERSION,
      user: toPublicUser(user),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(error.statusCode).send(error.message);
    }
    console.error("change password error:", error);
    return res.status(500).send("密碼修改失敗");
  }
};

const resetPassword = async (req, res) => {
  try {
    const result = await resetSellerPassword(req.validatedBody);
    return res.send({
      message: "密碼已重設，請保存新的救援碼",
      ...result,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(error.statusCode).send(error.message);
    }
    console.error("reset password error:", error);
    return res.status(500).send("密碼重設失敗");
  }
};

const regenerateRecoveryCode = async (req, res) => {
  try {
    return res.send({
      message: "新的救援碼已產生，舊救援碼已失效",
      ...(await regenerateSellerRecoveryCode(
        req.user._id,
        req.validatedBody.password
      )),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(error.statusCode).send(error.message);
    }
    console.error("recovery code error:", error);
    return res.status(500).send("救援碼產生失敗");
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    return res.send(
      await deleteSellerAccount({
        sellerId: req.user._id,
        password: req.validatedBody.password,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    return res.send(
      await getSellerSettings(req.user._id, {
        includeLinePayDetails: true,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const getStore = async (req, res, next) => {
  const sellerId = req.params.sellerId;
  const allowed =
    (req.user?.isSeller?.() && sameId(req.user._id, sellerId)) ||
    (req.user?.isBuyer?.() && sameId(req.user.qrSeller, sellerId));

  if (!allowed) return res.status(403).send("無法存取其他店家的設定");

  try {
    return res.send(await getSellerSettings(sellerId));
  } catch (error) {
    return next(error);
  }
};

const parseBoolean = (value, fallback) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

const updateSettings = async (req, res, next) => {
  try {
    return res.send(
      await updateSellerSettings({
        sellerId: req.user._id,
        acceptingOrders: parseBoolean(req.body.acceptingOrders, undefined),
        linePayMerchantReady: parseBoolean(
          req.body.linePayMerchantReady,
          undefined
        ),
        linePayChannelId: req.body.linePayChannelId,
        linePayChannelSecret: req.body.linePayChannelSecret,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res) => {
  const { username, password } = req.validatedBody;
  const ipAddress = getIpAddress(req);

  try {
    if (await loginAttempts.isBlocked(ipAddress, username)) {
      return res.status(429).send("登入嘗試次數過多，請稍後再試");
    }

    const user = await verifySellerCredentials({ username, password });
    if (!user) {
      await loginAttempts.recordFailure(ipAddress, username);
      return res.status(401).send("使用者名稱或密碼錯誤");
    }

    await loginAttempts.resetUsername(ipAddress, username);
    return res.send({
      message: "登入成功",
      token: signUserToken(user),
      authVersion: AUTH_VERSION,
      user: toPublicUser(user),
    });
  } catch (error) {
    if (error instanceof LoginAttemptStoreError) {
      return res.status(error.statusCode).send(error.message);
    }
    console.error("login error:", error);
    return res.status(500).send("登入服務暫時無法使用");
  }
};

module.exports = {
  changePassword,
  deleteAccount,
  getSettings,
  getStore,
  login,
  register,
  regenerateRecoveryCode,
  resetPassword,
  updateSettings,
};

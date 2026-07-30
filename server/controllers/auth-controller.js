const {
  AuthenticationError,
  registerSeller,
  verifySellerCredentials,
} = require("../services/auth-service");
const {
  AUTH_VERSION,
  signUserToken,
  toPublicUser,
} = require("../services/auth-token-service");
const {
  buildLoginAttemptService,
} = require("../services/login-attempt-service");

const loginAttempts = buildLoginAttemptService();

const getIpAddress = (req) => req.ip || req.socket?.remoteAddress || "unknown";

const register = async (req, res) => {
  try {
    const savedUser = await registerSeller(req.validatedBody);
    return res.status(201).send({
      msg: "使用者成功儲存",
      user: toPublicUser(savedUser),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(error.statusCode).send(error.message);
    }
    console.error("register error:", error);
    return res.status(500).send("無法儲存使用者");
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
    console.error("login error:", error);
    return res.status(500).send("登入服務暫時無法使用");
  }
};

module.exports = {
  login,
  register,
};

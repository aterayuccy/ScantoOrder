const crypto = require("crypto");

const secureCompare = (left, right) => {
  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
};

const supportAdminOnly = (req, res, next) => {
  const configuredKey = String(process.env.SUPPORT_ADMIN_KEY || "").trim();
  if (configuredKey.length < 24) {
    return res.status(503).send({
      message:
        "平台管理後台尚未設定，請先加入至少 24 個字元的 SUPPORT_ADMIN_KEY",
    });
  }

  const providedKey = String(req.get("x-support-admin-key") || "");
  if (!providedKey || !secureCompare(providedKey, configuredKey)) {
    return res.status(401).send({ message: "管理後台金鑰不正確" });
  }

  return next();
};

module.exports = supportAdminOnly;

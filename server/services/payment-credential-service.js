const crypto = require("crypto");

const CIPHER = "aes-256-gcm";
const VERSION = "v1";

class PaymentCredentialError extends Error {
  constructor(message) {
    super(message);
    this.name = "PaymentCredentialError";
  }
}

const getMasterKey = () => {
  const secret = String(
    process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY || ""
  ).trim();
  if (secret.length < 32) {
    throw new PaymentCredentialError(
      "付款金鑰加密設定尚未完成，請聯絡系統管理員"
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
};

const hasPaymentCredentialEncryptionKey = () =>
  String(process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY || "").trim().length >=
  32;

const encryptPaymentCredentials = (credentials) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER, getMasterKey(), iv);
  const plaintext = JSON.stringify(credentials);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
};

const decryptPaymentCredentials = (payload) => {
  try {
    const [version, iv, authTag, encrypted] = String(payload || "").split(".");
    if (version !== VERSION || !iv || !authTag || !encrypted) {
      throw new Error("invalid credential payload");
    }

    const decipher = crypto.createDecipheriv(
      CIPHER,
      getMasterKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(authTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const credentials = JSON.parse(plaintext);

    if (!credentials.channelId || !credentials.channelSecret) {
      throw new Error("incomplete credentials");
    }
    return credentials;
  } catch (error) {
    if (error instanceof PaymentCredentialError) throw error;
    throw new PaymentCredentialError("LINE Pay 金鑰無法讀取，請重新設定");
  }
};

module.exports = {
  PaymentCredentialError,
  decryptPaymentCredentials,
  encryptPaymentCredentials,
  hasPaymentCredentialEncryptionKey,
};

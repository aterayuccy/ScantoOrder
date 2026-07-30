const Joi = require("joi");

const {
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  getUsernameLength,
  isValidUsername,
  normalizeUsername,
} = require("../services/username-service");

const username = Joi.string()
  .custom((value, helpers) => {
    const normalized = normalizeUsername(value);
    const length = getUsernameLength(normalized);

    if (length < MIN_USERNAME_LENGTH || length > MAX_USERNAME_LENGTH) {
      return helpers.message({
        custom: `使用者名稱須為 ${MIN_USERNAME_LENGTH}～${MAX_USERNAME_LENGTH} 個字`,
      });
    }

    if (!isValidUsername(normalized)) {
      return helpers.message({
        custom: "使用者名稱只能包含中文、英文字母、數字與底線",
      });
    }

    return normalized;
  }, "username normalization")
  .required()
  .messages({
    "string.empty": "請輸入使用者名稱",
    "any.required": "請輸入使用者名稱",
  });

const password = Joi.string()
  .min(8)
  .max(64)
  .pattern(/^[\x20-\x7e]+$/)
  .pattern(/^(?=.*[A-Za-z])(?=.*\d).*$/)
  .required()
  .messages({
    "string.empty": "請輸入密碼",
    "string.min": "密碼至少需要 8 個字元",
    "string.max": "密碼最多只能有 64 個字元",
    "string.pattern.base":
      "密碼只能使用半形英文、數字及符號，且必須包含英文與數字",
    "any.required": "請輸入密碼",
  });

const registerSchema = Joi.object({
  username,
  password,
  role: Joi.string().required().valid("buyer", "seller"),
});

const loginSchema = Joi.object({
  username,
  password: Joi.string()
    .max(64)
    .pattern(/^[\x20-\x7e]+$/)
    .required()
    .messages({
      "string.empty": "請輸入密碼",
      "string.max": "密碼最多只能有 64 個字元",
      "string.pattern.base": "密碼只能使用半形英文、數字及符號",
      "any.required": "請輸入密碼",
    }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().max(64).required().messages({
    "string.empty": "請輸入目前密碼",
    "string.max": "目前密碼格式不正確",
    "any.required": "請輸入目前密碼",
  }),
  newPassword: password,
});

const resetPasswordSchema = Joi.object({
  username,
  recoveryCode: Joi.string()
    .trim()
    .replace(/[\s-]/g, "")
    .length(24)
    .hex()
    .required()
    .messages({
      "string.empty": "請輸入救援碼",
      "string.length": "救援碼格式不正確",
      "string.hex": "救援碼格式不正確",
      "any.required": "請輸入救援碼",
    }),
  newPassword: password,
});

const deleteAccountSchema = Joi.object({
  password: Joi.string().max(64).required().messages({
    "string.empty": "請輸入密碼確認刪除",
    "string.max": "密碼格式不正確",
    "any.required": "請輸入密碼確認刪除",
  }),
});

const recoveryCodeSchema = Joi.object({
  password: Joi.string().max(64).required().messages({
    "string.empty": "請輸入密碼",
    "string.max": "密碼格式不正確",
    "any.required": "請輸入密碼",
  }),
});

const qrLoginSchema = Joi.object({
  qrToken: Joi.string().hex().length(64).required().messages({
    "string.empty": "缺少 qrToken",
    "string.hex": "QR Code 格式不正確",
    "string.length": "QR Code 格式不正確",
    "any.required": "缺少 qrToken",
  }),
  clientSessionId: Joi.string()
    .trim()
    .min(16)
    .max(128)
    .pattern(/^[A-Za-z0-9_-]+$/)
    .optional()
    .messages({
      "string.min": "裝置識別碼格式不正確",
      "string.max": "裝置識別碼格式不正確",
      "string.pattern.base": "裝置識別碼格式不正確",
    }),
});

const qrCodeCountSchema = Joi.object({
  count: Joi.number().integer().min(1).max(100).required().messages({
    "number.base": "請輸入正確的 QR code 生成數量",
    "number.integer": "請輸入正確的 QR code 生成數量",
    "number.min": "請輸入正確的 QR code 生成數量",
    "number.max": "一次最多產生 100 個 QR code",
    "any.required": "請輸入正確的 QR code 生成數量",
  }),
});

const validate = (schema, data) =>
  schema.validate(data, { abortEarly: false, stripUnknown: true });

module.exports = {
  changePasswordSchema,
  deleteAccountSchema,
  loginSchema,
  loginValidation: (data) => validate(loginSchema, data),
  qrCodeCountSchema,
  qrLoginSchema,
  registerSchema,
  registerValidation: (data) => validate(registerSchema, data),
  recoveryCodeSchema,
  resetPasswordSchema,
};

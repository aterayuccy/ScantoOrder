const Joi = require("joi");

const reminderVisibilitySchema = Joi.object({
  hidden: Joi.boolean().strict().required(),
});

const renewalRequestSchema = Joi.object({
  transferAt: Joi.date().iso().required().messages({
    "date.base": "請輸入正確的轉帳時間",
    "date.format": "請輸入正確的轉帳時間",
    "any.required": "請輸入轉帳時間",
  }),
  accountLastFive: Joi.string()
    .trim()
    .pattern(/^\d{5}$/)
    .required()
    .messages({
      "string.pattern.base": "轉帳帳號末五碼必須是五位數字",
      "any.required": "請輸入轉帳帳號末五碼",
    }),
  note: Joi.string().trim().max(200).allow("").default(""),
});

const rejectRenewalSchema = Joi.object({
  message: Joi.string().trim().max(200).allow("").default(""),
});

module.exports = {
  rejectRenewalSchema,
  reminderVisibilitySchema,
  renewalRequestSchema,
};

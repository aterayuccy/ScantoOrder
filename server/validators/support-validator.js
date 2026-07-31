const Joi = require("joi");

const SUPPORT_CATEGORIES = ["technical", "operation", "suggestion", "other"];
const SUPPORT_STATUSES = ["open", "answered", "closed"];

const createSupportTicketSchema = Joi.object({
  category: Joi.string()
    .valid(...SUPPORT_CATEGORIES)
    .required()
    .messages({
      "any.only": "請選擇問題類型",
      "any.required": "請選擇問題類型",
    }),
  message: Joi.string().trim().min(5).max(2000).required().messages({
    "string.empty": "請輸入問題內容",
    "string.min": "問題內容至少需要 5 個字",
    "string.max": "問題內容最多 2000 個字",
    "any.required": "請輸入問題內容",
  }),
  pagePath: Joi.string().trim().max(500).allow("").default(""),
});

const updateSupportTicketSchema = Joi.object({
  adminReply: Joi.string().trim().max(2000).allow(""),
  status: Joi.string().valid(...SUPPORT_STATUSES),
})
  .or("adminReply", "status")
  .messages({
    "object.missing": "請輸入回覆或更新處理狀態",
    "any.only": "問題單狀態不正確",
    "string.max": "回覆內容最多 2000 個字",
  });

module.exports = {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  createSupportTicketSchema,
  updateSupportTicketSchema,
};

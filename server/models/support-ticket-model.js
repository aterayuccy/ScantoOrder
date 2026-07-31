const mongoose = require("mongoose");

const { Schema } = mongoose;

const SUPPORT_CATEGORIES = ["technical", "operation", "suggestion", "other"];
const SUPPORT_STATUSES = ["open", "answered", "closed"];

const supportTicketSchema = new Schema(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: SUPPORT_CATEGORIES,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    pagePath: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: SUPPORT_STATUSES,
      default: "open",
      index: true,
    },
    adminReply: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    repliedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

supportTicketSchema.index({ seller: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });

const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);

SupportTicket.SUPPORT_CATEGORIES = SUPPORT_CATEGORIES;
SupportTicket.SUPPORT_STATUSES = SUPPORT_STATUSES;

module.exports = SupportTicket;

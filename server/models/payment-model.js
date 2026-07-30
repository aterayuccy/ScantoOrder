const mongoose = require("mongoose");

const { Schema } = mongoose;

const paymentItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    lineItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 100,
    },
    checkoutKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderBatchId: {
      type: String,
      default: "",
      index: true,
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tableNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    method: {
      type: String,
      required: true,
      enum: ["store", "line_pay", "merchant_qr"],
    },
    providerMode: {
      type: String,
      required: true,
      enum: ["store", "mock", "sandbox", "production", "merchant_qr"],
    },
    providerTransactionId: {
      type: String,
      default: "",
      maxlength: 100,
    },
    providerPaymentUrl: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["TWD"],
      default: "TWD",
    },
    status: {
      type: String,
      required: true,
      enum: [
        "created",
        "pending",
        "pay_at_store",
        "awaiting_confirmation",
        "paid",
        "cancelled",
        "failed",
      ],
      default: "created",
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ["new", "accepted", "preparing", "completed", "cancelled"],
      default: "new",
      index: true,
    },
    invoicePreference: {
      type: String,
      enum: ["none", "mobile_carrier"],
      default: "none",
    },
    mobileCarrier: {
      type: String,
      default: "",
      maxlength: 8,
    },
    invoiceStatus: {
      type: String,
      enum: ["not_requested", "pending", "processed"],
      default: "not_requested",
    },
    items: {
      type: [paymentItemSchema],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failureMessage: {
      type: String,
      default: "",
      maxlength: 300,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ seller: 1, submittedAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);

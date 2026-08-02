const mongoose = require("mongoose");

const { Schema } = mongoose;

const platformSettingsSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "subscription",
    },
    monthlyFee: {
      type: Number,
      min: 0,
      max: 100000,
      default: 299,
    },
    payeeName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    paymentInstructions: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "完成轉帳後，請回到本頁提交轉帳時間與帳號末五碼。",
    },
    paymentQrImage: {
      type: String,
      default: "",
    },
    paymentQrImageStorage: {
      type: String,
      enum: ["local", "cloudinary"],
      default: "local",
    },
    paymentQrImagePublicId: {
      type: String,
      default: "",
      select: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);

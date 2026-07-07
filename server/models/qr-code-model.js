const mongoose = require("mongoose");
const { Schema } = mongoose;

const qrCodeSchema = new Schema(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tableNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

qrCodeSchema.index({ seller: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.model("QrCode", qrCodeSchema);

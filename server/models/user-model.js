const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 20,
      match: /^[\p{Script=Han}A-Za-z0-9_]+$/u,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      maxlength: 64,
      match: /^[\x20-\x7e]+$/,
      select: false,
    },
    role: {
      type: String,
      enum: ["buyer", "seller"],
      required: true,
    },
    tokenVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    recoveryCodeHash: {
      type: String,
      default: undefined,
      select: false,
    },
    recoveryCodeCreatedAt: {
      type: Date,
      default: undefined,
      select: false,
    },
    acceptingOrders: {
      type: Boolean,
      default: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ["trial", "paid", "suspended"],
      default: "trial",
      index: true,
    },
    subscriptionStartedAt: {
      type: Date,
      default: undefined,
    },
    serviceExpiresAt: {
      type: Date,
      default: undefined,
      index: true,
    },
    subscriptionTestOriginalExpiresAt: {
      type: Date,
      default: null,
    },
    subscriptionTestOriginalStatus: {
      type: String,
      enum: ["trial", "paid", "suspended"],
      default: null,
    },
    subscriptionReminderHiddenForExpiry: {
      type: Date,
      default: null,
    },
    renewalRequestStatus: {
      type: String,
      enum: ["none", "pending", "rejected"],
      default: "none",
    },
    renewalRequestedAt: {
      type: Date,
      default: null,
    },
    renewalTransferAt: {
      type: Date,
      default: null,
    },
    renewalAccountLastFive: {
      type: String,
      default: "",
      maxlength: 5,
    },
    renewalNote: {
      type: String,
      default: "",
      maxlength: 200,
    },
    renewalReviewMessage: {
      type: String,
      default: "",
      maxlength: 200,
    },
    lastSubscriptionPaymentAt: {
      type: Date,
      default: null,
    },
    lastSubscriptionPaymentConfirmedAt: {
      type: Date,
      default: null,
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
    linePayMerchantReady: {
      type: Boolean,
      default: false,
    },
    linePayConfigured: {
      type: Boolean,
      default: false,
    },
    linePayChannelIdHint: {
      type: String,
      default: "",
      maxlength: 8,
    },
    linePayCredentialsEncrypted: {
      type: String,
      default: "",
      select: false,
    },
    tableNumber: {
      type: Number,
      default: null,
    },
    qrSeller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestSessionKey: {
      type: String,
      default: undefined,
      select: false,
    },
    guestExpiresAt: {
      type: Date,
      default: undefined,
      select: false,
    },
    lastSeenAt: {
      type: Date,
      default: undefined,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index(
  { username: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  }
);
userSchema.index(
  { guestSessionKey: 1 },
  {
    unique: true,
    sparse: true,
  }
);
userSchema.index(
  { guestExpiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { role: "buyer" },
  }
);

userSchema.methods.isBuyer = function isBuyer() {
  return this.role === "buyer";
};

userSchema.methods.isSeller = function isSeller() {
  return this.role === "seller";
};

userSchema.pre("validate", function normalizeStoredUsername() {
  if (this.isNew || this.isModified("username")) {
    this.username = this.username.normalize("NFKC").trim();
  }
});

userSchema.methods.comparePassword = async function comparePassword(
  password,
  callback
) {
  try {
    return callback(null, await bcrypt.compare(password, this.password));
  } catch (error) {
    return callback(error);
  }
};

userSchema.pre("save", async function hashPassword() {
  if (this.isNew || this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

module.exports = mongoose.model("User", userSchema);

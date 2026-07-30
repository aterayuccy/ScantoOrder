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

const mongoose = require("mongoose");

const { Schema } = mongoose;

const optionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    priceAdjustment: {
      type: Number,
      default: 0,
      min: -9999,
      max: 9999,
    },
  },
  { _id: true }
);

const optionGroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    selectionType: {
      type: String,
      enum: ["single", "multiple"],
      default: "single",
    },
    required: {
      type: Boolean,
      default: false,
    },
    maxSelections: {
      type: Number,
      default: 1,
      min: 0,
      max: 30,
    },
    options: {
      type: [optionSchema],
      default: [],
    },
  },
  { _id: true }
);

const selectedOptionSchema = new Schema(
  {
    groupId: { type: String, required: true },
    groupName: { type: String, required: true },
    optionId: { type: String, required: true },
    optionName: { type: String, required: true },
    priceAdjustment: { type: Number, default: 0 },
  },
  { _id: false }
);

const buyerItemSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    quantity: { type: Number, default: 1, min: 1 },
    tableNumber: { type: Number, default: null },
    submittedAt: { type: Date, default: null },
    selectedOptions: {
      type: [selectedOptionSchema],
      default: [],
    },
    specialRequest: {
      type: String,
      default: "",
      maxlength: 300,
    },
    specialRequestLabel: {
      type: String,
      default: "備註或特殊需求",
      maxlength: 40,
    },
    titleSnapshot: {
      type: String,
      default: "",
    },
    basePrice: {
      type: Number,
      min: 0,
      default: null,
    },
    unitPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    selectionKey: {
      type: String,
      default: "",
    },
    orderBatchId: {
      type: String,
      default: "",
      index: true,
    },
  },
  { _id: true }
);

const productSchema = new Schema({
  id: { type: String },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  price: {
    type: Number,
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  buyer: {
    type: [buyerItemSchema],
    default: [],
  },
  type: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: "",
  },
  optionGroups: {
    type: [optionGroupSchema],
    default: [],
  },
  specialRequestConfig: {
    enabled: {
      type: Boolean,
      default: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "備註或特殊需求",
    },
    maxLength: {
      type: Number,
      min: 1,
      max: 300,
      default: 200,
    },
  },
});

module.exports = mongoose.model("Product", productSchema);

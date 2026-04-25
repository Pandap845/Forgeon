const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: ["technology", "business", "gaming", "health", "other"],
    },
    coverImageUrl: { type: String, trim: true, default: "" },
    iconImageUrl: { type: String, trim: true, default: "" },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    memberCount: { type: Number, min: 0, default: 1 },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Groups", groupSchema);

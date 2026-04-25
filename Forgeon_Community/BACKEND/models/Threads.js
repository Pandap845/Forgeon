const mongoose = require("mongoose");

const threadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    imageUrl: { type: String, trim: true, default: "" },
    publishTo: {
      type: String,
      required: true,
      enum: ["general", "group"],
      default: "general",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Groups",
      default: null,
      index: true,
    },
    likesCount: { type: Number, min: 0, default: 0 },
    commentsCount: { type: Number, min: 0, default: 0 },
    lastActivityBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Threads", threadSchema);

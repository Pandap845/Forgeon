const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    thread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Threads",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comments",
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    likesCount: { type: Number, min: 0, default: 0 },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comments", commentSchema);



const mongoose = require("mongoose");


const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 40,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },

    passwordHash: {
       type: String, required: true
       },

    birthday: { type: Date },
    avatarUrl: { type: String, trim: true, default: "" },
    level: { type: Number, min: 1, default: 1 },
    bio: { type: String, trim: true, maxlength: 500, default: "" },
    postsPublished: { type: Number, min: 0, default: 0 },
    groupsCount: { type: Number, min: 0, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

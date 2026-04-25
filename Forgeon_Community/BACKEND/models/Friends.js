const mongoose = require("mongoose");

const friendsSchema = new mongoose.Schema(
  {
    userA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    connectedAt: { type: Date, default: Date.now },
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

friendsSchema.index({ userA: 1, userB: 1 }, { unique: true });

friendsSchema.pre("validate", function normalizeUsers(next) {
  if (!this.userA || !this.userB) return next();
  if (this.userA.toString() === this.userB.toString()) {
    return next(new Error("A user cannot be friends with themselves."));
  }

  if (this.userA.toString() > this.userB.toString()) {
    const temp = this.userA;
    this.userA = this.userB;
    this.userB = temp;
  }
  return next();
});

module.exports = mongoose.model("Friends", friendsSchema);

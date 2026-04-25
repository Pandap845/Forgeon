const mongoose = require("mongoose");

const friendsInvitationSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mutualFriendsSnapshot: { type: Number, min: 0, default: 0 },
    message: { type: String, trim: true, maxlength: 500, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    sentAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

friendsInvitationSchema.index(
  { sender: 1, recipient: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

friendsInvitationSchema.pre("validate", function preventSelfInvite(next) {
  if (
    this.sender &&
    this.recipient &&
    this.sender.toString() === this.recipient.toString()
  ) {
    return next(new Error("A user cannot invite themselves."));
  }
  return next();
});

module.exports = mongoose.model(
  "friends_invitation",
  friendsInvitationSchema
);

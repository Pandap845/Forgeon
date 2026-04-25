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
    mutualFriends: { type: Number, min: 0, default: 0 },
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

//Index configuration
friendsInvitationSchema.index(
  { sender: 1, recipient: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);



module.exports = mongoose.model(
  "friends_invitation",
  friendsInvitationSchema
);

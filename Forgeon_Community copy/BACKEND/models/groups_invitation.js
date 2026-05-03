const mongoose = require("mongoose");

const groupsInvitationSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Groups",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invitee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    inviteeEmail: { type: String, trim: true, lowercase: true, default: null },
    message: { type: String, trim: true, maxlength: 500, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    sentAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

groupsInvitationSchema.index(
  { group: 1, invitee: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending", invitee: { $type: "objectId" } },
  }
);

groupsInvitationSchema.index(
  { group: 1, inviteeEmail: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending", inviteeEmail: { $type: "string" } },
  }
);

module.exports = mongoose.model("groups_invitation", groupsInvitationSchema);

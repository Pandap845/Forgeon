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


//Validations
friendsSchema.index({ userA: 1, userB: 1 }, { unique: true });


//export
module.exports = mongoose.model("Friends", friendsSchema);

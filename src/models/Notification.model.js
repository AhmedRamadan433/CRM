const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "NEW_MESSAGE",
        "CONVERSATION_ASSIGNED",
        "LEAD_ASSIGNED",
        "FOLLOWUP_ASSIGNED",
        "FOLLOWUP_DUE",
        "FOLLOWUP_OVERDUE",
        "DEAL_UPDATED",
        "DEAL_WON",
        "NOTE_MENTION",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

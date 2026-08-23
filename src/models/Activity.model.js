const mongoose = require("mongoose");

const ACTIVITY_ACTIONS = [
  "LEAD_CREATED",
  "LEAD_ASSIGNED",
  "STATUS_CHANGED",
  "CONVERSATION_ASSIGNED",
  "MESSAGE_SENT",
  "FOLLOWUP_CREATED",
  "FOLLOWUP_COMPLETED",
  "NOTE_CREATED",
  "DEAL_CREATED",
  "DEAL_WON",
  "DEAL_LOST",
];

const ENTITY_TYPES = [
  "LEAD",
  "CUSTOMER",
  "CONVERSATION",
  "MESSAGE",
  "FOLLOWUP",
  "NOTE",
  "DEAL",
];

const activitySchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Actor is required"],
    },
    action: {
      type: String,
      enum: {
        values: ACTIVITY_ACTIONS,
        message: "Invalid activity action",
      },
      required: [true, "Action is required"],
    },
    entityType: {
      type: String,
      enum: {
        values: ENTITY_TYPES,
        message: "Invalid entity type",
      },
      required: [true, "Entity type is required"],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Entity id is required"],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activitySchema.index({ actorId: 1, createdAt: -1 });
const Activity = mongoose.model("Activity", activitySchema);
module.exports = { Activity, ACTIVITY_ACTIONS, ENTITY_TYPES };

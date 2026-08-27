const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: ["OPEN", "CLOSED", "ARCHIVED"],
        message: "Invalid conversation status",
      },
      default: "OPEN",
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      trim: true,
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },

    unreadCount: {
      type: Number,
      default: 0,
      min: [0, "Unread count cannot be negative"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

conversationSchema.index({ assignedTo: 1, status: 1, updatedAt: -1 });
conversationSchema.index({ customerId: 1, updatedAt: -1 });

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

module.exports = Conversation;

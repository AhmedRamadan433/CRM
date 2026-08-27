const mongoose = require("mongoose");

const MESSAGE_TYPES = ["TEXT", "IMAGE", "FILE", "AUDIO", "VIDEO", "SYSTEM"];

const MESSAGE_STATUSES = ["SENT", "DELIVERED", "READ"];

const MESSAGE_DIRECTIONS = ["INBOUND", "OUTBOUND"];

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "Conversation is required"],
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required"],
    },

    content: {
      type: String,
      required: [true, "Content is required"],
      trim: true,
    },

    type: {
      type: String,
      enum: {
        values: MESSAGE_TYPES,
        message: "Invalid message type",
      },
      default: "TEXT",
      uppercase: true,
    },

    direction: {
      type: String,
      enum: {
        values: MESSAGE_DIRECTIONS,
        message: "Invalid message direction",
      },
      default: "OUTBOUND",
    },

    attachments: {
      type: [String],
      default: [],
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: MESSAGE_STATUSES,
        message: "Invalid message status",
      },
      default: "SENT",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Indexes for efficient conversation history queries
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ content: "text" });

// Status transition helper (SENT -> DELIVERED -> READ)
messageSchema.methods.markAs = function (newStatus) {
  const order = { SENT: 0, DELIVERED: 1, READ: 2 };
  if (!(newStatus in order)) throw new Error("Invalid target status");
  if (order[newStatus] < order[this.status])
    throw new Error(
      `Cannot move status backwards from ${this.status} to ${newStatus}`,
    );
  this.status = newStatus;
  return this;
};

const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);

module.exports = {
  Message,
  MESSAGE_TYPES,
  MESSAGE_STATUSES,
  MESSAGE_DIRECTIONS,
};

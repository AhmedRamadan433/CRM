const mongoose = require("mongoose");

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "NEGOTIATION",
  "WON",
  "LOST",
];

const LOST_REASONS = [
  "TOO_EXPENSIVE",
  "BOUGHT_FROM_COMPETITOR",
  "NOT_INTERESTED",
  "DELAYED",
  "OTHER",
];

const ALLOWED_TRANSITIONS = {
  NEW: ["CONTACTED"],
  CONTACTED: ["INTERESTED"],
  INTERESTED: ["NEGOTIATION", "LOST"],
  NEGOTIATION: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

const leadSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    product: {
      type: String,
      trim: true,
    },

    budget: {
      type: Number,
      min: [0, "Budget cannot be negative"],
    },

    source: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: {
        values: LEAD_STATUSES,
        message: "Invalid lead status",
      },
      default: "NEW",
    },

    lostReason: {
      type: String,
      enum: {
        values: LOST_REASONS,
        message: "Invalid lost reason",
      },
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    expectedCloseDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Validate and apply lead status transition
leadSchema.methods.transitionTo = function (newStatus, { reason } = {}) {
  const currentStatus = this.status;

  // Validate target status
  if (!LEAD_STATUSES.includes(newStatus)) {
    throw new Error("Invalid target status");
  }

  // Get allowed next statuses
  const allowedStatuses = ALLOWED_TRANSITIONS[currentStatus];

  // Validate transition
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error(
      `Transition from ${currentStatus} to ${newStatus} is not allowed`,
    );
  }

  // LOST requires a reason
  if (newStatus === "LOST" && !reason) {
    throw new Error("Lost reason is required when status is LOST");
  }

  // Update status
  this.status = newStatus;

  // Set or clear lost reason
  if (newStatus === "LOST") {
    this.lostReason = reason;
  } else {
    this.lostReason = undefined;
  }

  return this;
};

const Lead = mongoose.model("Lead", leadSchema);

module.exports = {
  Lead,
  LEAD_STATUSES,
  LOST_REASONS,
  ALLOWED_TRANSITIONS,
};

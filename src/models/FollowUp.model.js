const mongoose = require("mongoose");

const FOLLOWUP_STATUSES = ["PENDING", "COMPLETED", "CANCELLED", "OVERDUE"];

const FOLLOWUP_TYPES = ["CALL", "MEETING", "EMAIL", "TASK", "OTHER"];

const followUpSchema = new mongoose.Schema(
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
      required: [true, "Assigned user is required"],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: null,
    },

    type: {
      type: String,
      enum: {
        values: FOLLOWUP_TYPES,
        message: "Invalid follow-up type",
      },
      default: "TASK",
      uppercase: true,
    },

    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },

    status: {
      type: String,
      enum: {
        values: FOLLOWUP_STATUSES,
        message: "Invalid follow-up status",
      },
      default: "PENDING",
      uppercase: true,
    },

    result: {
      type: String,
      trim: true,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Indexes
followUpSchema.index({
  assignedTo: 1,
  dueDate: 1,
});

followUpSchema.index({
  customerId: 1,
  dueDate: -1,
});

followUpSchema.index({
  leadId: 1,
});

followUpSchema.index({
  status: 1,
  dueDate: 1,
});

followUpSchema.index({
  createdBy: 1,
  createdAt: -1,
});

// Check if follow-up is overdue
followUpSchema.methods.checkOverdue = function () {
  if (this.status === "PENDING" && this.dueDate < new Date()) {
    this.status = "OVERDUE";

    return true;
  }

  return false;
};

// Complete follow-up
followUpSchema.methods.complete = function (result) {
  if (this.status !== "PENDING" && this.status !== "OVERDUE") {
    throw new Error(`Cannot complete follow-up with status ${this.status}`);
  }

  this.status = "COMPLETED";
  this.result = result || null;
  this.completedAt = new Date();

  return this;
};

// Cancel follow-up
followUpSchema.methods.cancel = function (reason) {
  if (this.status === "COMPLETED") {
    throw new Error("Cannot cancel a completed follow-up");
  }

  this.status = "CANCELLED";
  this.result = reason || null;

  return this;
};

// Reopen follow-up
followUpSchema.methods.reopen = function () {
  if (this.status !== "COMPLETED" && this.status !== "CANCELLED") {
    throw new Error(`Cannot reopen follow-up with status ${this.status}`);
  }

  this.status = "PENDING";
  this.result = null;
  this.completedAt = null;

  return this;
};

// Virtual
followUpSchema.virtual("isOverdue").get(function () {
  return this.status === "PENDING" && this.dueDate < new Date();
});

// Include virtuals in JSON/Object
followUpSchema.set("toJSON", {
  virtuals: true,
});

followUpSchema.set("toObject", {
  virtuals: true,
});

const FollowUp =
  mongoose.models.FollowUp || mongoose.model("FollowUp", followUpSchema);

module.exports = {
  FollowUp,
  FOLLOWUP_STATUSES,
  FOLLOWUP_TYPES,
};

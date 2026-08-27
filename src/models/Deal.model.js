const mongoose = require("mongoose");

const DEAL_STAGES = ["NEGOTIATION", "WON", "LOST"];

const DEAL_LOST_REASONS = [
  "TOO_EXPENSIVE",
  "BOUGHT_FROM_COMPETITOR",
  "NOT_INTERESTED",
  "DELAYED",
  "OTHER",
];

const ALLOWED_STAGE_TRANSITIONS = {
  NEGOTIATION: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

const dealSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: [true, "Lead is required"],
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    value: {
      type: Number,
      required: [true, "Deal value is required"],
      min: [0, "Value cannot be negative"],
    },

    currency: {
      type: String,
      trim: true,
      default: "EGP",
      uppercase: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    stage: {
      type: String,
      enum: {
        values: DEAL_STAGES,
        message: "Invalid deal stage",
      },
      default: "NEGOTIATION",
      uppercase: true,
    },

    lostReason: {
      type: String,
      enum: {
        values: DEAL_LOST_REASONS,
        message: "Invalid lost reason",
      },
    },

    expectedCloseDate: {
      type: Date,
    },

    actualCloseDate: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Indexes
dealSchema.index({ customerId: 1, createdAt: -1 });
dealSchema.index({ leadId: 1 });
dealSchema.index({ assignedTo: 1, stage: 1 });
dealSchema.index({ stage: 1, createdAt: -1 });
dealSchema.index({ value: -1 });

// Validate and apply stage transition
dealSchema.methods.transitionTo = function (newStage, { reason } = {}) {
  const currentStage = this.stage;

  if (!DEAL_STAGES.includes(newStage)) {
    throw new Error("Invalid target stage");
  }

  const allowedStages = ALLOWED_STAGE_TRANSITIONS[currentStage];

  if (!allowedStages.includes(newStage)) {
    throw new Error(
      `Transition from ${currentStage} to ${newStage} is not allowed`,
    );
  }

  if (newStage === "LOST" && !reason) {
    throw new Error("Lost reason is required when stage is LOST");
  }

  this.stage = newStage;
  this.actualCloseDate = new Date();

  if (newStage === "LOST") {
    this.lostReason = reason;
  } else {
    this.lostReason = undefined;
  }

  return this;
};

// Virtual for isClosed
dealSchema.virtual("isClosed").get(function () {
  return this.stage === "WON" || this.stage === "LOST";
});

// Include virtuals in JSON
dealSchema.set("toJSON", { virtuals: true });
dealSchema.set("toObject", { virtuals: true });

const Deal = mongoose.models.Deal || mongoose.model("Deal", dealSchema);

module.exports = {
  Deal,
  DEAL_STAGES,
  DEAL_LOST_REASONS,
  ALLOWED_STAGE_TRANSITIONS,
};

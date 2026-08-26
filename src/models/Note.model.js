const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },

    content: {
      type: String,
      required: [true, "Note content is required"],
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Note author is required"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Note must belong to either a Customer or a Lead
noteSchema.pre("validate", function (next) {
  if (!this.customerId && !this.leadId) {
    return next(new Error("Note must belong to a customer or a lead"));
  }

  if (this.customerId && this.leadId) {
    return next(new Error("Note cannot belong to both customer and lead"));
  }
});

// Indexes
noteSchema.index({ customerId: 1, createdAt: -1 });
noteSchema.index({ leadId: 1, createdAt: -1 });
noteSchema.index({ createdBy: 1, createdAt: -1 });

const Note = mongoose.models.Note || mongoose.model("Note", noteSchema);

module.exports = Note;

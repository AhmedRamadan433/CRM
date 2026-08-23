const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Phone is required"],
      unique: [true, "Phone number must be unique"],
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },

    avatar: {
      type: String,
      default: null,
    },

    tags: {
      type: [String],
      default: [],
    },

    source: {
      type: String,
      trim: true,
    },

    notes: {
      type: String,
      trim: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;

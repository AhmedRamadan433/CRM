const express = require("express");
const followUpController = require("../controllers/followUp.controller");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");

const router = express.Router();

// All follow-up routes require authentication
router.use(protect);

// Get all follow-ups
router.get(
  "/",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  followUpController.getAllFollowUps,
);

// Create follow-up
router.post(
  "/",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  followUpController.createFollowUp,
);

// Get follow-up by ID
router.get(
  "/:id",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  followUpController.getFollowUpById,
);

// Update follow-up
router.patch(
  "/:id",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  followUpController.updateFollowUp,
);

// Complete follow-up
router.patch(
  "/:id/complete",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  followUpController.completeFollowUp,
);

// Cancel follow-up
router.patch(
  "/:id/cancel",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  followUpController.cancelFollowUp,
);

module.exports = router;

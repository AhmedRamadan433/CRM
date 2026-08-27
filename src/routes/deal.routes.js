const express = require("express");
const dealController = require("../controllers/deal.controller");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");

const router = express.Router();

// All deal routes require authentication
router.use(protect);

// Get all deals
router.get(
  "/",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dealController.getAllDeals,
);

// Create deal
router.post(
  "/",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dealController.createDeal,
);

// Get deal by ID
router.get(
  "/:id",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dealController.getDealById,
);

// Update deal
router.patch(
  "/:id",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dealController.updateDeal,
);

// Assign deal
router.patch(
  "/:id/assign",
  restrictTo("ADMIN", "MANAGER"),
  dealController.assignDeal,
);

// Change deal stage
router.patch(
  "/:id/stage",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dealController.changeDealStage,
);

// Mark deal as WON
router.patch(
  "/:id/won",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dealController.markDealAsWon,
);

// Mark deal as LOST
router.patch(
  "/:id/lost",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dealController.markDealAsLost,
);

module.exports = router;

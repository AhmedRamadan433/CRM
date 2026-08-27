const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");

const router = express.Router();

// All dashboard routes require authentication
router.use(protect);

// Get full dashboard (includes all overview + breakdowns)
router.get(
  "/",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dashboardController.getDashboard,
);

// Get overview metrics only
router.get(
  "/overview",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dashboardController.getOverviewMetrics,
);

// Get leads by status
router.get(
  "/leads/status",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dashboardController.getLeadsByStatus,
);

// Get deals by stage
router.get(
  "/deals/stage",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  dashboardController.getDealsByStage,
);

// Manager-only metrics
router.get(
  "/leads/source",
  restrictTo("ADMIN", "MANAGER"),
  dashboardController.getLeadsBySource,
);

router.get(
  "/sales/performance",
  restrictTo("ADMIN", "MANAGER"),
  dashboardController.getSalesPerformance,
);

router.get(
  "/revenue/period",
  restrictTo("ADMIN", "MANAGER"),
  dashboardController.getRevenueByPeriod,
);

module.exports = router;

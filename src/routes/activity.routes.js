const express = require("express");

const activityController = require("../controllers/activity.controller");

const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);

// Get activities
router.get(
  "/",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  activityController.getAllActivities,
);

// Get activities for specific entity
router.get(
  "/:entityType/:entityId",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  activityController.getEntityActivities,
);

module.exports = router;

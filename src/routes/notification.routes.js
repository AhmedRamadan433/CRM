const express = require("express");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");
const controller = require("../controllers/notification.controller");

const router = express.Router();
router.use(protect, restrictTo("ADMIN", "MANAGER", "SALES_AGENT"));
router.get("/", controller.getNotifications);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);
router.delete("/:id", controller.deleteNotification);
module.exports = router;

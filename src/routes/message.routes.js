const express = require("express");
const messageController = require("../controllers/message.controller");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");

const router = express.Router();

// All message routes require authentication
router.use(protect);

// Send message
router.post(
  "/",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  messageController.sendMessage,
);

// Get conversation messages — must be before /:id
router.get(
  "/conversation/:conversationId",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  messageController.getConversationMessages,
);

// Get single message + update status
router.get(
  "/:id",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  messageController.getMessageById,
);

router.patch(
  "/:id/status",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  messageController.updateMessageStatus,
);

module.exports = router;

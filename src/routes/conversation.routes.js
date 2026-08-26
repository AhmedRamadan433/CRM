const express = require("express");

const conversationController = require("../controllers/conversation.controller");

const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");

const router = express.Router();

// All conversation routes require authentication
router.use(protect);

// Get all conversations
router.get(
  "/",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  conversationController.getAllConversations,
);

// Create conversation
router.post(
  "/",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  conversationController.createConversation,
);

// Get conversation by ID
router.get(
  "/:id",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  conversationController.getConversationById,
);

// Update conversation
router.patch(
  "/:id",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  conversationController.updateConversation,
);

// Assign conversation
router.patch(
  "/:id/assign",
  restrictTo("ADMIN", "MANAGER"),
  conversationController.assignConversation,
);

// Change conversation status
router.patch(
  "/:id/status",
  restrictTo("ADMIN", "MANAGER", "SALES_AGENT"),
  conversationController.changeConversationStatus,
);

module.exports = router;

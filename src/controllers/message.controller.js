const { Message } = require("../models/Message.model");
const Conversation = require("../models/Conversation.model");

const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

const { createActivity } = require("../services/activity.service");

// Validate user access to conversation
const hasConversationAccess = (conversation, user) => {
  if (!conversation || !user) {
    return false;
  }

  // ADMIN and MANAGER have full access
  if (["ADMIN", "MANAGER"].includes(user.role)) {
    return true;
  }

  // SALES_AGENT
  // Can access unassigned conversations
  if (!conversation.assignedTo) {
    return true;
  }

  // Can access assigned conversations
  return conversation.assignedTo.toString() === user._id.toString();
};

// Send message
const sendMessage = asyncwrapper(async (req, res, next) => {
  const conversationId = req.params.id;

  const {
    content,
    type = "TEXT",
    direction = "OUTBOUND",
    attachments = [],
    replyTo = null,
  } = req.body;

  // Validate conversationId
  if (!conversationId) {
    return next(
      new AppError("Conversation ID is required", 400, HttpStatusText.FAIL),
    );
  }

  // Validate content
  if (!content || !content.trim()) {
    return next(
      new AppError("Message content is required", 400, HttpStatusText.FAIL),
    );
  }

  // Check conversation exists
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return next(
      new AppError("Conversation not found", 404, HttpStatusText.FAIL),
    );
  }

  // Check sender access
  if (!hasConversationAccess(conversation, req.user)) {
    return next(
      new AppError(
        "You do not have permission to send messages in this conversation",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  // Cannot send to archived conversation
  if (conversation.status === "ARCHIVED") {
    return next(
      new AppError(
        "Cannot send message to an archived conversation",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  // Validate replyTo
  if (replyTo) {
    const parentMessage = await Message.findById(replyTo);

    if (!parentMessage) {
      return next(
        new AppError("Reply-to message not found", 404, HttpStatusText.FAIL),
      );
    }

    if (parentMessage.conversationId.toString() !== conversationId.toString()) {
      return next(
        new AppError(
          "Reply-to message does not belong to this conversation",
          400,
          HttpStatusText.FAIL,
        ),
      );
    }
  }

  // Create message
  const message = await Message.create({
    conversationId,
    senderId: req.user._id,
    content: content.trim(),
    type: type.toUpperCase(),
    direction: direction.toUpperCase(),
    attachments,
    replyTo: replyTo || null,
    status: "SENT",
  });

  // Update conversation information
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: message.content,
    lastMessageAt: message.createdAt,
    $inc: {
      unreadCount: 1,
    },
  });

  // Activity Log
  await createActivity({
    actorId: req.user._id,
    action: "MESSAGE_SENT",
    entityType: "MESSAGE",
    entityId: message._id,
    metadata: {
      conversationId,
      type: message.type,
      direction: message.direction,
    },
  });

  // Populate message
  const populatedMessage = await message.populate([
    {
      path: "senderId",
      select: "name email role avatar",
    },
    {
      path: "replyTo",
    },
  ]);

  res.status(201).json({
    status: HttpStatusText.CREATED,
    message: "Message sent successfully",
    data: {
      message: populatedMessage,
    },
  });
});

// Get conversation messages
const getConversationMessages = asyncwrapper(async (req, res, next) => {
  const conversationId = req.params.id;

  // Check conversation exists
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return next(
      new AppError("Conversation not found", 404, HttpStatusText.FAIL),
    );
  }

  // Check access
  if (!hasConversationAccess(conversation, req.user)) {
    return next(
      new AppError(
        "You do not have permission to view messages in this conversation",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  // Pagination
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    Message.find({
      conversationId,
    })
      .populate("senderId", "name email role avatar")
      .populate("replyTo")
      .sort({
        createdAt: 1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Message.countDocuments({
      conversationId,
    }),
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: messages.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    data: {
      messages,
    },
  });
});

// Get message by ID
const getMessageById = asyncwrapper(async (req, res, next) => {
  const message = await Message.findById(req.params.id)
    .populate("senderId", "name email role avatar")
    .populate("replyTo");

  if (!message) {
    return next(new AppError("Message not found", 404, HttpStatusText.FAIL));
  }

  // Check parent conversation
  const conversation = await Conversation.findById(message.conversationId);

  if (!conversation) {
    return next(
      new AppError("Parent conversation not found", 404, HttpStatusText.FAIL),
    );
  }

  // Check access
  if (!hasConversationAccess(conversation, req.user)) {
    return next(
      new AppError(
        "You do not have permission to view this message",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      message,
    },
  });
});

// Update message status
const updateMessageStatus = asyncwrapper(async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return next(new AppError("Status is required", 400, HttpStatusText.FAIL));
  }

  // Get message
  const message = await Message.findById(req.params.id);

  if (!message) {
    return next(new AppError("Message not found", 404, HttpStatusText.FAIL));
  }

  // Get conversation
  const conversation = await Conversation.findById(message.conversationId);

  if (!conversation) {
    return next(
      new AppError("Conversation not found", 404, HttpStatusText.FAIL),
    );
  }

  // Check access
  if (!hasConversationAccess(conversation, req.user)) {
    return next(
      new AppError(
        "You do not have permission to update this message",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  const oldStatus = message.status;

  try {
    message.markAs(status.toUpperCase());

    await message.save();
  } catch (error) {
    return next(new AppError(error.message, 400, HttpStatusText.FAIL));
  }

  // Decrease unread count only when
  // message actually changes to READ
  if (
    oldStatus !== "READ" &&
    message.status === "READ" &&
    conversation.unreadCount > 0
  ) {
    await Conversation.findByIdAndUpdate(conversation._id, {
      $inc: {
        unreadCount: -1,
      },
    });
  }

  // Populate response
  await message.populate([
    {
      path: "senderId",
      select: "name email role avatar",
    },
    {
      path: "replyTo",
    },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Message status updated successfully",
    data: {
      message,
    },
  });
});

module.exports = {
  sendMessage,
  getConversationMessages,
  getMessageById,
  updateMessageStatus,
};

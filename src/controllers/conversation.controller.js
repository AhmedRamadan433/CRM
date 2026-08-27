const Conversation = require("../models/Conversation.model");
const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const { Lead } = require("../models/Lead.model");

const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

const { createActivity } = require("../services/activity.service");
const { notify } = require("../services/notification.service");

const conversationAccessFilter = (req) =>
  req.user.role === "SALES_AGENT" ? { assignedTo: req.user._id } : {};

// Create a new conversation
const createConversation = asyncwrapper(async (req, res, next) => {
  const { customerId, leadId, assignedTo } = req.body;
  const effectiveAssignedTo =
    req.user.role === "SALES_AGENT" ? req.user._id : assignedTo;

  // Check customer exists
  const customerExists = await Customer.exists({
    _id: customerId,
  });

  if (!customerExists) {
    return next(new AppError("Customer not found", 404, HttpStatusText.FAIL));
  }

  // Check lead exists if provided
  if (leadId) {
    const leadExists = await Lead.exists({
      _id: leadId,
    });

    if (!leadExists) {
      return next(new AppError("Lead not found", 404, HttpStatusText.FAIL));
    }
  }

  // Check assigned user if provided
  if (effectiveAssignedTo) {
    const user = await User.findById(effectiveAssignedTo);

    if (!user) {
      return next(
        new AppError("Assigned user not found", 404, HttpStatusText.FAIL),
      );
    }

    if (user.status === "INACTIVE") {
      return next(
        new AppError(
          "Cannot assign conversation to an inactive user",
          400,
          HttpStatusText.FAIL,
        ),
      );
    }
  }

  const conversation = await Conversation.create({
    customerId,
    leadId: leadId || null,
    assignedTo: effectiveAssignedTo || null,
  });

  // Activity log
  try {
    await createActivity({
      actorId: req.user._id,
      action: "CONVERSATION_CREATED",
      entityType: "CONVERSATION",
      entityId: conversation._id,
      metadata: {
        customerId: conversation.customerId,
        leadId: conversation.leadId,
        assignedTo: conversation.assignedTo,
      },
    });
  } catch (error) {
    // Activity failure should not break conversation creation
    return next(
      new AppError("Failed to create activity log", 500, HttpStatusText.FAIL),
    );
  }

  res.status(201).json({
    status: HttpStatusText.CREATED,
    message: "Conversation created successfully",
    data: {
      conversation,
    },
  });
});

// Get all conversations
const getAllConversations = asyncwrapper(async (req, res, next) => {
  const filter = conversationAccessFilter(req);
  if (req.query.status) filter.status = req.query.status.toUpperCase();
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 20, 1),
    100,
  );
  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .populate("customerId", "name email phone")
      .populate("leadId", "title status product")
      .populate("assignedTo", "name email role")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: conversations.length,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data: {
      conversations,
    },
  });
});

// Get conversation by ID
const getConversationById = asyncwrapper(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    ...conversationAccessFilter(req),
  })
    .populate("customerId")
    .populate("leadId")
    .populate("assignedTo");

  if (!conversation) {
    return next(
      new AppError("Conversation not found", 404, HttpStatusText.FAIL),
    );
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      conversation,
    },
  });
});

// Update conversation
const updateConversation = asyncwrapper(async (req, res, next) => {
  const { id } = req.params;

  const { customerId, leadId, lastMessage, lastMessageAt, unreadCount } =
    req.body;

  // Check customer if provided
  if (customerId) {
    const customerExists = await Customer.exists({
      _id: customerId,
    });

    if (!customerExists) {
      return next(new AppError("Customer not found", 404, HttpStatusText.FAIL));
    }
  }

  // Check lead if provided
  if (leadId) {
    const leadExists = await Lead.exists({
      _id: leadId,
    });

    if (!leadExists) {
      return next(new AppError("Lead not found", 404, HttpStatusText.FAIL));
    }
  }

  const conversation = await Conversation.findOneAndUpdate(
    { _id: id, ...conversationAccessFilter(req) },
    {
      customerId,
      leadId,
      lastMessage,
      lastMessageAt,
      unreadCount,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!conversation) {
    return next(
      new AppError("Conversation not found", 404, HttpStatusText.FAIL),
    );
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Conversation updated successfully",
    data: {
      conversation,
    },
  });
});

// Assign conversation
const assignConversation = asyncwrapper(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    return next(new AppError("User ID is required", 400, HttpStatusText.FAIL));
  }

  // Check user
  const user = await User.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404, HttpStatusText.FAIL));
  }

  if (user.status === "INACTIVE") {
    return next(
      new AppError(
        "Cannot assign conversation to an inactive user",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  // Get conversation first to know old assignee
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(
      new AppError("Conversation not found", 404, HttpStatusText.FAIL),
    );
  }

  const oldAssignedTo = conversation.assignedTo;

  conversation.assignedTo = userId;

  await conversation.save();
  await notify(
    userId,
    "CONVERSATION_ASSIGNED",
    "Conversation assigned",
    "A conversation was assigned to you.",
    "CONVERSATION",
    conversation._id,
  );

  // Activity log
  try {
    await createActivity({
      actorId: req.user._id,
      action: "CONVERSATION_ASSIGNED",
      entityType: "CONVERSATION",
      entityId: conversation._id,
      metadata: {
        from: oldAssignedTo,
        to: userId,
      },
    });
  } catch (error) {
    return next(
      new AppError("Failed to create activity log", 500, HttpStatusText.FAIL),
    );
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Conversation assigned successfully",
    data: {
      conversation,
    },
  });
});

// Change conversation status
const changeConversationStatus = asyncwrapper(async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return next(new AppError("Status is required", 400, HttpStatusText.FAIL));
  }

  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(
      new AppError("Conversation not found", 404, HttpStatusText.FAIL),
    );
  }

  const oldStatus = conversation.status;

  conversation.status = status.toUpperCase();

  try {
    await conversation.save();
  } catch (error) {
    return next(new AppError(error.message, 400, HttpStatusText.FAIL));
  }

  // Activity log
  try {
    await createActivity({
      actorId: req.user._id,
      action: "CONVERSATION_STATUS_CHANGED",
      entityType: "CONVERSATION",
      entityId: conversation._id,
      metadata: {
        from: oldStatus,
        to: conversation.status,
      },
    });
  } catch (error) {
    console.error("Failed to create activity:", error.message);
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Conversation status updated successfully",
    data: {
      conversation,
    },
  });
});

module.exports = {
  createConversation,
  getAllConversations,
  getConversationById,
  updateConversation,
  assignConversation,
  changeConversationStatus,
};

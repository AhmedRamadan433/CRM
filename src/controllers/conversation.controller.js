const Conversation = require("../models/Conversation.model");
const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const { Lead } = require("../models/Lead.model");

const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

const { createActivity } = require("../services/activity.service");

// Create a new conversation
const createConversation = asyncwrapper(async (req, res, next) => {
  const { customerId, leadId, assignedTo } = req.body;

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
  if (assignedTo) {
    const user = await User.findById(assignedTo);

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
    assignedTo: assignedTo || null,
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
  const conversations = await Conversation.find()
    .populate("customerId")
    .populate("leadId")
    .populate("assignedTo");

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: conversations.length,
    data: {
      conversations,
    },
  });
});

// Get conversation by ID
const getConversationById = asyncwrapper(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id)
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

  const conversation = await Conversation.findByIdAndUpdate(
    id,
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

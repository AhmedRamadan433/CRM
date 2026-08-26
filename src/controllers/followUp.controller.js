const { FollowUp } = require("../models/FollowUp.model");
const Customer = require("../models/Customer.model");
const { Lead } = require("../models/Lead.model");
const User = require("../models/User.model");
const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

let createActivity = null;
try {
  ({ createActivity } = require("../services/activity.service"));
} catch (_) {
  createActivity = null;
}

/**
 * Access control:
 * ADMIN/MANAGER: full access to all follow-ups
 * SALES_AGENT: only follow-ups assigned to them or created by them
 */
const hasFollowUpAccess = (followUp, user) => {
  if (!followUp || !user) return false;
  if (["ADMIN", "MANAGER"].includes(user.role)) return true;
  return (
    followUp.assignedTo.toString() === user._id.toString() ||
    followUp.createdBy.toString() === user._id.toString()
  );
};

// Create follow-up
const createFollowUp = asyncwrapper(async (req, res, next) => {
  const { customerId, leadId, assignedTo, title, description, type, dueDate } =
    req.body;

  if (!customerId) {
    return next(
      new AppError("Customer ID is required", 400, HttpStatusText.FAIL),
    );
  }

  if (!title) {
    return next(
      new AppError("Title is required", 400, HttpStatusText.FAIL),
    );
  }

  if (!dueDate) {
    return next(
      new AppError("Due date is required", 400, HttpStatusText.FAIL),
    );
  }

  if (!assignedTo) {
    return next(
      new AppError("Assigned user is required", 400, HttpStatusText.FAIL),
    );
  }

  // Validate customer exists
  const customer = await Customer.findById(customerId);
  if (!customer) {
    return next(
      new AppError("Customer not found", 404, HttpStatusText.FAIL),
    );
  }

  // Validate assigned user exists and is active
  const assignedUser = await User.findById(assignedTo);
  if (!assignedUser) {
    return next(
      new AppError("Assigned user not found", 404, HttpStatusText.FAIL),
    );
  }
  if (assignedUser.status === "INACTIVE") {
    return next(
      new AppError(
        "Cannot assign follow-up to an inactive user",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  // Validate lead if provided
  if (leadId) {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return next(
        new AppError("Lead not found", 404, HttpStatusText.FAIL),
      );
    }
  }

  // Validate dueDate is in the future for new follow-ups
  if (new Date(dueDate) < new Date()) {
    return next(
      new AppError("Due date must be in the future", 400, HttpStatusText.FAIL),
    );
  }

  const followUp = await FollowUp.create({
    customerId,
    leadId: leadId || null,
    assignedTo,
    createdBy: req.user._id,
    title: title.trim(),
    description: description ? description.trim() : null,
    type: type ? type.toUpperCase() : "TASK",
    dueDate,
  });

  if (createActivity) {
    try {
      await createActivity({
        actorId: req.user._id,
        action: "FOLLOWUP_CREATED",
        entityType: "FOLLOWUP",
        entityId: followUp._id,
        metadata: {
          customerId,
          leadId,
          assignedTo,
          title: followUp.title,
          dueDate: followUp.dueDate,
          type: followUp.type,
        },
      });
    } catch (_) {
      // silent
    }
  }

  const populated = await followUp.populate([
    { path: "customerId", select: "name email phone" },
    { path: "leadId", select: "title status" },
    { path: "assignedTo", select: "name email role" },
    { path: "createdBy", select: "name email role" },
  ]);

  res.status(201).json({
    status: HttpStatusText.SUCCESS,
    message: "Follow-up created successfully",
    data: {
      followUp: populated,
    },
  });
});

// Get all follow-ups with filters
const getAllFollowUps = asyncwrapper(async (req, res, next) => {
  const { status, assignedTo, customerId, leadId, type, dueBefore, dueAfter } =
    req.query;

  const filter = {};

  // Agent sees only own follow-ups
  if (req.user.role === "SALES_AGENT") {
    filter.$or = [
      { assignedTo: req.user._id },
      { createdBy: req.user._id },
    ];
  }

  if (status) filter.status = status.toUpperCase();
  if (assignedTo) filter.assignedTo = assignedTo;
  if (customerId) filter.customerId = customerId;
  if (leadId) filter.leadId = leadId;
  if (type) filter.type = type.toUpperCase();

  if (dueBefore || dueAfter) {
    filter.dueDate = {};
    if (dueBefore) filter.dueDate.$lte = new Date(dueBefore);
    if (dueAfter) filter.dueDate.$gte = new Date(dueAfter);
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 20, 1),
    100,
  );
  const skip = (page - 1) * limit;
  const sortBy = req.query.sortBy || "dueDate";
  const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;

  const [followUps, total] = await Promise.all([
    FollowUp.find(filter)
      .populate("customerId", "name email phone")
      .populate("leadId", "title status")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email role")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    FollowUp.countDocuments(filter),
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: followUps.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    data: {
      followUps,
    },
  });
});

// Get follow-up by ID
const getFollowUpById = asyncwrapper(async (req, res, next) => {
  const followUp = await FollowUp.findById(req.params.id)
    .populate("customerId", "name email phone")
    .populate("leadId", "title status")
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email role");

  if (!followUp) {
    return next(
      new AppError("Follow-up not found", 404, HttpStatusText.FAIL),
    );
  }

  // Prevent invalid follow-up access
  if (!hasFollowUpAccess(followUp, req.user)) {
    return next(
      new AppError(
        "You do not have permission to view this follow-up",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      followUp,
    },
  });
});

// Update follow-up
const updateFollowUp = asyncwrapper(async (req, res, next) => {
  const { title, description, type, dueDate, assignedTo } = req.body;

  const followUp = await FollowUp.findById(req.params.id);
  if (!followUp) {
    return next(
      new AppError("Follow-up not found", 404, HttpStatusText.FAIL),
    );
  }

  // Prevent invalid follow-up access
  if (!hasFollowUpAccess(followUp, req.user)) {
    return next(
      new AppError(
        "You do not have permission to update this follow-up",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  // Only allow updates on PENDING or OVERDUE follow-ups
  if (followUp.status !== "PENDING" && followUp.status !== "OVERDUE") {
    return next(
      new AppError(
        `Cannot update follow-up with status ${followUp.status}`,
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  if (assignedTo) {
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      return next(
        new AppError("Assigned user not found", 404, HttpStatusText.FAIL),
      );
    }
    if (assignedUser.status === "INACTIVE") {
      return next(
        new AppError(
          "Cannot assign follow-up to an inactive user",
          400,
          HttpStatusText.FAIL,
        ),
      );
    }
  }

  const updates = {};
  if (title) updates.title = title.trim();
  if (description !== undefined) updates.description = description ? description.trim() : null;
  if (type) updates.type = type.toUpperCase();
  if (dueDate) updates.dueDate = dueDate;
  if (assignedTo) updates.assignedTo = assignedTo;

  const updated = await FollowUp.findByIdAndUpdate(
    req.params.id,
    updates,
    { runValidators: true, returnDocument: "after" },
  );

  const populated = await updated.populate([
    { path: "customerId", select: "name email phone" },
    { path: "leadId", select: "title status" },
    { path: "assignedTo", select: "name email role" },
    { path: "createdBy", select: "name email role" },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Follow-up updated successfully",
    data: {
      followUp: populated,
    },
  });
});

// Complete follow-up
const completeFollowUp = asyncwrapper(async (req, res, next) => {
  const { result } = req.body;

  const followUp = await FollowUp.findById(req.params.id);
  if (!followUp) {
    return next(
      new AppError("Follow-up not found", 404, HttpStatusText.FAIL),
    );
  }

  // Prevent invalid follow-up access
  if (!hasFollowUpAccess(followUp, req.user)) {
    return next(
      new AppError(
        "You do not have permission to complete this follow-up",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  try {
    followUp.complete(result);
    await followUp.save();
  } catch (error) {
    return next(new AppError(error.message, 400, HttpStatusText.FAIL));
  }

  if (createActivity) {
    try {
      await createActivity({
        actorId: req.user._id,
        action: "FOLLOWUP_COMPLETED",
        entityType: "FOLLOWUP",
        entityId: followUp._id,
        metadata: {
          customerId: followUp.customerId,
          leadId: followUp.leadId,
          result: followUp.result,
        },
      });
    } catch (_) {
      // silent
    }
  }

  const populated = await followUp.populate([
    { path: "customerId", select: "name email phone" },
    { path: "leadId", select: "title status" },
    { path: "assignedTo", select: "name email role" },
    { path: "createdBy", select: "name email role" },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Follow-up completed successfully",
    data: {
      followUp: populated,
    },
  });
});

// Cancel follow-up
const cancelFollowUp = asyncwrapper(async (req, res, next) => {
  const { reason } = req.body;

  const followUp = await FollowUp.findById(req.params.id);
  if (!followUp) {
    return next(
      new AppError("Follow-up not found", 404, HttpStatusText.FAIL),
    );
  }

  // Prevent invalid follow-up access
  if (!hasFollowUpAccess(followUp, req.user)) {
    return next(
      new AppError(
        "You do not have permission to cancel this follow-up",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  try {
    followUp.cancel(reason);
    await followUp.save();
  } catch (error) {
    return next(new AppError(error.message, 400, HttpStatusText.FAIL));
  }

  const populated = await followUp.populate([
    { path: "customerId", select: "name email phone" },
    { path: "leadId", select: "title status" },
    { path: "assignedTo", select: "name email role" },
    { path: "createdBy", select: "name email role" },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Follow-up cancelled successfully",
    data: {
      followUp: populated,
    },
  });
});

module.exports = {
  createFollowUp,
  getAllFollowUps,
  getFollowUpById,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
};

const { Lead } = require("../models/Lead.model");
const Customer = require("../models/Customer.model");
const User = require("../models/User.model");

const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

const { createActivity } = require("../services/activity.service");
const { notify } = require("../services/notification.service");

const leadAccessFilter = (req) =>
  req.user.role === "SALES_AGENT" ? { assignedTo: req.user._id } : {};

// Create new lead
const createLead = asyncwrapper(async (req, res, next) => {
  const {
    customerId,
    title,
    product,
    budget,
    source,
    assignedTo,
    expectedCloseDate,
  } = req.body;

  // Check customer exists
  const customerExists = await Customer.exists({
    _id: customerId,
  });

  if (!customerExists) {
    return next(new AppError("Customer not found", 404, HttpStatusText.FAIL));
  }

  // Check assigned user
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
          "Cannot assign lead to an inactive user",
          400,
          HttpStatusText.FAIL,
        ),
      );
    }
  }

  const lead = await Lead.create({
    customerId,
    title,
    product,
    budget,
    source,
    assignedTo: req.user.role === "SALES_AGENT" ? req.user._id : assignedTo,
    expectedCloseDate,
  });

  await createActivity({
    actorId: req.user._id,
    action: "LEAD_CREATED",
    entityType: "LEAD",
    entityId: lead._id,
    metadata: {
      customerId: lead.customerId,
      title: lead.title,
      product: lead.product,
      budget: lead.budget,
      source: lead.source,
      expectedCloseDate: lead.expectedCloseDate,
    },
  });

  res.status(201).json({
    status: HttpStatusText.CREATED,
    message: "Lead created successfully",
    data: lead,
  });
});

// Get all leads + filters
const getAllLeads = asyncwrapper(async (req, res, next) => {
  const { status, assignedTo, customerId, source } = req.query;

  const filter = {};
  Object.assign(filter, leadAccessFilter(req));

  if (status) {
    filter.status = status;
  }

  if (assignedTo && req.user.role !== "SALES_AGENT") {
    filter.assignedTo = assignedTo;
  }

  if (customerId) {
    filter.customerId = customerId;
  }

  if (source) {
    filter.source = source;
  }

  const leads = await Lead.find(filter)
    .populate("customerId")
    .populate("assignedTo")
    .lean();

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: leads.length,
    data: leads,
  });
});

// Get lead by ID
const getLeadById = asyncwrapper(async (req, res, next) => {
  const lead = await Lead.findOne({ _id: req.params.id, ...leadAccessFilter(req) })
    .populate("customerId")
    .populate("assignedTo")
    .lean();

  if (!lead) {
    return next(new AppError("Lead not found", 404, HttpStatusText.FAIL));
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: lead,
  });
});

// Update lead
const updateLeadById = asyncwrapper(async (req, res, next) => {
  const { title, product, budget, source, expectedCloseDate } = req.body;

  const lead = await Lead.findOneAndUpdate(
    { _id: req.params.id, ...leadAccessFilter(req) },
    {
      title,
      product,
      budget,
      source,
      expectedCloseDate,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!lead) {
    return next(new AppError("Lead not found", 404, HttpStatusText.FAIL));
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: lead,
  });
});

// Assign lead to user
const assignLeadToUser = asyncwrapper(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    return next(new AppError("User ID is required", 400, HttpStatusText.FAIL));
  }

  // We need the user data because we check status
  const user = await User.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404, HttpStatusText.FAIL));
  }

  if (user.status === "INACTIVE") {
    return next(
      new AppError(
        "Cannot assign lead to an inactive user",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  const lead = await Lead.findOneAndUpdate(
    { _id: req.params.id, ...leadAccessFilter(req) },
    {
      assignedTo: userId,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!lead) {
    return next(new AppError("Lead not found", 404, HttpStatusText.FAIL));
  }

  await createActivity({
    actorId: req.user._id,
    action: "LEAD_ASSIGNED",
    entityType: "LEAD",
    entityId: lead._id,
    metadata: {
      assignedTo: userId,
    },
  });
  await notify(
    userId,
    "LEAD_ASSIGNED",
    "Lead assigned",
    `Lead "${lead.title}" was assigned to you.`,
    "LEAD",
    lead._id,
  );

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Lead assigned successfully",
    data: lead,
  });
});

// Change lead status
const changeLeadStatus = asyncwrapper(async (req, res, next) => {
  const { status, lostReason } = req.body;

  if (!status) {
    return next(new AppError("Status is required", 400, HttpStatusText.FAIL));
  }

  const lead = await Lead.findOne({ _id: req.params.id, ...leadAccessFilter(req) });

  if (!lead) {
    return next(new AppError("Lead not found", 404, HttpStatusText.FAIL));
  }

  const oldStatus = lead.status;

  try {
    lead.transitionTo(status, {
      reason: lostReason,
    });

    await lead.save();
  } catch (error) {
    return next(new AppError(error.message, 400, HttpStatusText.FAIL));
  }

  await createActivity({
    actorId: req.user._id,
    action: "STATUS_CHANGED",
    entityType: "LEAD",
    entityId: lead._id,
    metadata: {
      from: oldStatus,
      to: lead.status,
      lostReason: lostReason || null,
    },
  });

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Lead status updated successfully",
    data: lead,
  });
});

module.exports = {
  createLead,
  getAllLeads,
  getLeadById,
  updateLeadById,
  assignLeadToUser,
  changeLeadStatus,
};

const { Deal } = require("../models/Deal.model");
const Customer = require("../models/Customer.model");
const { Lead } = require("../models/Lead.model");
const User = require("../models/User.model");

const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

const { createActivity } = require("../services/activity.service");

const fullAccessRoles = ["ADMIN", "MANAGER"];

// Check deal access
const hasDealAccess = (deal, user) => {
  if (!deal || !user) return false;

  if (fullAccessRoles.includes(user.role)) {
    return true;
  }

  return deal.assignedTo && deal.assignedTo.toString() === user._id.toString();
};

// Create deal
const createDeal = asyncwrapper(async (req, res, next) => {
  const {
    customerId,
    leadId,
    title,
    value,
    currency,
    assignedTo,
    expectedCloseDate,
    notes,
  } = req.body;

  if (!customerId) {
    return next(
      new AppError("Customer ID is required", 400, HttpStatusText.FAIL),
    );
  }

  if (!leadId) {
    return next(new AppError("Lead ID is required", 400, HttpStatusText.FAIL));
  }

  if (!title) {
    return next(new AppError("Title is required", 400, HttpStatusText.FAIL));
  }

  if (value === undefined || value === null) {
    return next(
      new AppError("Deal value is required", 400, HttpStatusText.FAIL),
    );
  }

  // Check customer exists
  const customerExists = await Customer.exists({
    _id: customerId,
  });

  if (!customerExists) {
    return next(new AppError("Customer not found", 404, HttpStatusText.FAIL));
  }

  // We need lead data to validate customer and status
  const lead = await Lead.findById(leadId);

  if (!lead) {
    return next(new AppError("Lead not found", 404, HttpStatusText.FAIL));
  }

  // Lead must belong to same customer
  if (lead.customerId.toString() !== customerId.toString()) {
    return next(
      new AppError(
        "Lead does not belong to this customer",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  // Lead must be in valid status
  if (lead.status !== "NEGOTIATION" && lead.status !== "INTERESTED") {
    return next(
      new AppError(
        `Cannot create deal for lead with status ${lead.status}. Lead must be in NEGOTIATION or INTERESTED stage`,
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  // We need user data because we check status
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
          "Cannot assign deal to an inactive user",
          400,
          HttpStatusText.FAIL,
        ),
      );
    }
  }

  const deal = await Deal.create({
    customerId,
    leadId,
    title: title.trim(),
    value,
    currency: currency || "EGP",
    assignedTo: assignedTo || null,
    expectedCloseDate: expectedCloseDate || null,
    notes: notes ? notes.trim() : null,
  });

  try {
    await createActivity({
      actorId: req.user._id,
      action: "DEAL_CREATED",
      entityType: "DEAL",
      entityId: deal._id,
      metadata: {
        customerId,
        leadId,
        title: deal.title,
        value: deal.value,
        currency: deal.currency,
        stage: deal.stage,
      },
    });
  } catch (_) {
    // Activity failure should not break deal creation
  }

  const populated = await deal.populate([
    {
      path: "customerId",
      select: "name email phone",
    },
    {
      path: "leadId",
      select: "title status product",
    },
    {
      path: "assignedTo",
      select: "name email role",
    },
  ]);

  res.status(201).json({
    status: HttpStatusText.SUCCESS,
    message: "Deal created successfully",
    data: {
      deal: populated,
    },
  });
});

// Get all deals with filters
const getAllDeals = asyncwrapper(async (req, res, next) => {
  const {
    stage,
    assignedTo,
    customerId,
    leadId,
    minValue,
    maxValue,
    currency,
    expectedCloseBefore,
    expectedCloseAfter,
  } = req.query;

  const filter = {};

  // SALES_AGENT sees only own deals
  if (req.user.role === "SALES_AGENT") {
    filter.assignedTo = req.user._id;
  }

  if (stage) {
    filter.stage = stage.toUpperCase();
  }

  if (assignedTo) {
    filter.assignedTo = assignedTo;
  }

  if (customerId) {
    filter.customerId = customerId;
  }

  if (leadId) {
    filter.leadId = leadId;
  }

  if (currency) {
    filter.currency = currency.toUpperCase();
  }

  if (minValue || maxValue) {
    filter.value = {};

    if (minValue) {
      filter.value.$gte = Number(minValue);
    }

    if (maxValue) {
      filter.value.$lte = Number(maxValue);
    }
  }

  if (expectedCloseBefore || expectedCloseAfter) {
    filter.expectedCloseDate = {};

    if (expectedCloseBefore) {
      filter.expectedCloseDate.$lte = new Date(expectedCloseBefore);
    }

    if (expectedCloseAfter) {
      filter.expectedCloseDate.$gte = new Date(expectedCloseAfter);
    }
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const skip = (page - 1) * limit;

  const sortBy = req.query.sortBy || "createdAt";

  const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;

  const [deals, total] = await Promise.all([
    Deal.find(filter)
      .populate("customerId", "name email phone")
      .populate("leadId", "title status product")
      .populate("assignedTo", "name email role")
      .sort({
        [sortBy]: sortOrder,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Deal.countDocuments(filter),
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: deals.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    data: {
      deals,
    },
  });
});

// Get deal by ID
const getDealById = asyncwrapper(async (req, res, next) => {
  const deal = await Deal.findById(req.params.id)
    .populate("customerId", "name email phone")
    .populate("leadId", "title status product")
    .populate("assignedTo", "name email role");

  if (!deal) {
    return next(new AppError("Deal not found", 404, HttpStatusText.FAIL));
  }

  if (!hasDealAccess(deal, req.user)) {
    return next(
      new AppError(
        "You do not have permission to view this deal",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      deal,
    },
  });
});

// Update deal
const updateDeal = asyncwrapper(async (req, res, next) => {
  const { title, value, currency, expectedCloseDate, notes } = req.body;

  const deal = await Deal.findById(req.params.id);

  if (!deal) {
    return next(new AppError("Deal not found", 404, HttpStatusText.FAIL));
  }

  if (!hasDealAccess(deal, req.user)) {
    return next(
      new AppError(
        "You do not have permission to update this deal",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  if (deal.stage !== "NEGOTIATION") {
    return next(
      new AppError(
        `Cannot update deal with stage ${deal.stage}`,
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  const updates = {};

  if (title !== undefined) {
    updates.title = title.trim();
  }

  if (value !== undefined) {
    updates.value = value;
  }

  if (currency !== undefined) {
    updates.currency = currency.toUpperCase();
  }

  if (expectedCloseDate !== undefined) {
    updates.expectedCloseDate = expectedCloseDate;
  }

  if (notes !== undefined) {
    updates.notes = notes ? notes.trim() : null;
  }

  const updated = await Deal.findByIdAndUpdate(req.params.id, updates, {
    runValidators: true,
    returnDocument: "after",
  });

  const populated = await updated.populate([
    {
      path: "customerId",
      select: "name email phone",
    },
    {
      path: "leadId",
      select: "title status product",
    },
    {
      path: "assignedTo",
      select: "name email role",
    },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Deal updated successfully",
    data: {
      deal: populated,
    },
  });
});

// Assign deal
const assignDeal = asyncwrapper(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    return next(new AppError("User ID is required", 400, HttpStatusText.FAIL));
  }

  // Need user data because we check status
  const user = await User.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404, HttpStatusText.FAIL));
  }

  if (user.status === "INACTIVE") {
    return next(
      new AppError(
        "Cannot assign deal to an inactive user",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  const deal = await Deal.findById(req.params.id);

  if (!deal) {
    return next(new AppError("Deal not found", 404, HttpStatusText.FAIL));
  }

  if (!hasDealAccess(deal, req.user)) {
    return next(
      new AppError(
        "You do not have permission to assign this deal",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  const oldAssignedTo = deal.assignedTo;

  deal.assignedTo = userId;

  await deal.save();

  try {
    await createActivity({
      actorId: req.user._id,
      action: "DEAL_ASSIGNED",
      entityType: "DEAL",
      entityId: deal._id,
      metadata: {
        from: oldAssignedTo,
        to: userId,
      },
    });
  } catch (_) {
    // Activity failure should not break assignment
  }

  const populated = await deal.populate([
    {
      path: "customerId",
      select: "name email phone",
    },
    {
      path: "leadId",
      select: "title status product",
    },
    {
      path: "assignedTo",
      select: "name email role",
    },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Deal assigned successfully",
    data: {
      deal: populated,
    },
  });
});

// Mark deal as WON
const markDealAsWon = asyncwrapper(async (req, res, next) => {
  const deal = await Deal.findById(req.params.id);

  if (!deal) {
    return next(new AppError("Deal not found", 404, HttpStatusText.FAIL));
  }

  if (!hasDealAccess(deal, req.user)) {
    return next(
      new AppError(
        "You do not have permission to update this deal",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  try {
    deal.transitionTo("WON");
    await deal.save();
  } catch (error) {
    return next(new AppError(error.message, 400, HttpStatusText.FAIL));
  }

  await Lead.findByIdAndUpdate(deal.leadId, {
    status: "WON",
  });

  try {
    await createActivity({
      actorId: req.user._id,
      action: "DEAL_WON",
      entityType: "DEAL",
      entityId: deal._id,
      metadata: {
        customerId: deal.customerId,
        leadId: deal.leadId,
        value: deal.value,
        currency: deal.currency,
        closedAt: deal.actualCloseDate,
      },
    });
  } catch (_) {
    // Activity failure should not break deal flow
  }

  const populated = await deal.populate([
    {
      path: "customerId",
      select: "name email phone",
    },
    {
      path: "leadId",
      select: "title status product",
    },
    {
      path: "assignedTo",
      select: "name email role",
    },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Deal marked as WON successfully",
    data: {
      deal: populated,
    },
  });
});

// Mark deal as LOST
const markDealAsLost = asyncwrapper(async (req, res, next) => {
  const { lostReason } = req.body;

  if (!lostReason) {
    return next(
      new AppError("Lost reason is required", 400, HttpStatusText.FAIL),
    );
  }

  const deal = await Deal.findById(req.params.id);

  if (!deal) {
    return next(new AppError("Deal not found", 404, HttpStatusText.FAIL));
  }

  if (!hasDealAccess(deal, req.user)) {
    return next(
      new AppError(
        "You do not have permission to update this deal",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  try {
    deal.transitionTo("LOST", {
      reason: lostReason,
    });

    await deal.save();
  } catch (error) {
    return next(new AppError(error.message, 400, HttpStatusText.FAIL));
  }

  await Lead.findByIdAndUpdate(deal.leadId, {
    status: "LOST",
    lostReason,
  });

  try {
    await createActivity({
      actorId: req.user._id,
      action: "DEAL_LOST",
      entityType: "DEAL",
      entityId: deal._id,
      metadata: {
        customerId: deal.customerId,
        leadId: deal.leadId,
        lostReason,
        value: deal.value,
        currency: deal.currency,
        closedAt: deal.actualCloseDate,
      },
    });
  } catch (_) {
    // Activity failure should not break deal flow
  }

  const populated = await deal.populate([
    {
      path: "customerId",
      select: "name email phone",
    },
    {
      path: "leadId",
      select: "title status product",
    },
    {
      path: "assignedTo",
      select: "name email role",
    },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Deal marked as LOST successfully",
    data: {
      deal: populated,
    },
  });
});

// Change deal stage
const changeDealStage = asyncwrapper(async (req, res, next) => {
  const { stage, lostReason } = req.body;

  if (!stage) {
    return next(new AppError("Stage is required", 400, HttpStatusText.FAIL));
  }

  const deal = await Deal.findById(req.params.id);

  if (!deal) {
    return next(new AppError("Deal not found", 404, HttpStatusText.FAIL));
  }

  if (!hasDealAccess(deal, req.user)) {
    return next(
      new AppError(
        "You do not have permission to update this deal",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  const oldStage = deal.stage;

  try {
    deal.transitionTo(stage.toUpperCase(), {
      reason: lostReason,
    });

    await deal.save();
  } catch (error) {
    return next(new AppError(error.message, 400, HttpStatusText.FAIL));
  }

  if (deal.stage === "WON") {
    await Lead.findByIdAndUpdate(deal.leadId, {
      status: "WON",
    });
  }

  if (deal.stage === "LOST") {
    await Lead.findByIdAndUpdate(deal.leadId, {
      status: "LOST",
      lostReason: deal.lostReason,
    });
  }

  try {
    const action = deal.stage === "WON" ? "DEAL_WON" : "DEAL_LOST";

    await createActivity({
      actorId: req.user._id,
      action,
      entityType: "DEAL",
      entityId: deal._id,
      metadata: {
        from: oldStage,
        to: deal.stage,
        lostReason: deal.lostReason || null,
        value: deal.value,
        currency: deal.currency,
      },
    });
  } catch (_) {
    // Activity failure should not break deal flow
  }

  const populated = await deal.populate([
    {
      path: "customerId",
      select: "name email phone",
    },
    {
      path: "leadId",
      select: "title status product",
    },
    {
      path: "assignedTo",
      select: "name email role",
    },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: `Deal stage updated to ${deal.stage} successfully`,
    data: {
      deal: populated,
    },
  });
});

module.exports = {
  createDeal,
  getAllDeals,
  getDealById,
  updateDeal,
  assignDeal,
  markDealAsWon,
  markDealAsLost,
  changeDealStage,
};

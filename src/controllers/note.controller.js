const { Note } = require("../models/Note.model");
const Customer = require("../models/Customer.model");
const { Lead } = require("../models/Lead.model");
const Conversation = require("../models/Conversation.model");
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
 * ADMIN/MANAGER: full access to all notes
 * SALES_AGENT: only notes created by them or assigned to them
 */
const hasNoteAccess = (note, user) => {
  if (!note || !user) return false;
  if (["ADMIN", "MANAGER"].includes(user.role)) return true;
  return note.createdBy.toString() === user._id.toString();
};

// Create note
const createNote = asyncwrapper(async (req, res, next) => {
  const { customerId, leadId, conversationId, followUpId, title, content, type } =
    req.body;

  if (!customerId) {
    return next(
      new AppError("Customer ID is required", 400, HttpStatusText.FAIL),
    );
  }

  if (!content) {
    return next(
      new AppError("Note content is required", 400, HttpStatusText.FAIL),
    );
  }

  // Validate customer exists
  const customer = await Customer.findById(customerId);
  if (!customer) {
    return next(
      new AppError("Customer not found", 404, HttpStatusText.FAIL),
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

  // Validate conversation if provided
  if (conversationId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return next(
        new AppError("Conversation not found", 404, HttpStatusText.FAIL),
      );
    }
  }

  // Validate followUp if provided
  if (followUpId) {
    const { FollowUp } = require("../models/FollowUp.model");
    const followUp = await FollowUp.findById(followUpId);
    if (!followUp) {
      return next(
        new AppError("Follow-up not found", 404, HttpStatusText.FAIL),
      );
    }
  }

  const note = await Note.create({
    customerId,
    leadId: leadId || null,
    conversationId: conversationId || null,
    followUpId: followUpId || null,
    createdBy: req.user._id,
    title: title ? title.trim() : null,
    content: content.trim(),
    type: type ? type.toUpperCase() : "GENERAL",
  });

  if (createActivity) {
    try {
      await createActivity({
        actorId: req.user._id,
        action: "NOTE_CREATED",
        entityType: "NOTE",
        entityId: note._id,
        metadata: {
          customerId,
          leadId,
          conversationId,
          followUpId,
          type: note.type,
        },
      });
    } catch (_) {
      // silent
    }
  }

  const populated = await note.populate([
    { path: "customerId", select: "name email phone" },
    { path: "leadId", select: "title status" },
    { path: "conversationId", select: "status" },
    { path: "followUpId", select: "title status" },
    { path: "createdBy", select: "name email role" },
  ]);

  res.status(201).json({
    status: HttpStatusText.SUCCESS,
    message: "Note created successfully",
    data: {
      note: populated,
    },
  });
});

// Get all notes with filters
const getAllNotes = asyncwrapper(async (req, res, next) => {
  const { customerId, leadId, conversationId, followUpId, type } = req.query;

  const filter = {};

  if (customerId) filter.customerId = customerId;
  if (leadId) filter.leadId = leadId;
  if (conversationId) filter.conversationId = conversationId;
  if (followUpId) filter.followUpId = followUpId;
  if (type) filter.type = type.toUpperCase();

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 20, 1),
    100,
  );
  const skip = (page - 1) * limit;

  const [notes, total] = await Promise.all([
    Note.find(filter)
      .populate("customerId", "name email phone")
      .populate("leadId", "title status")
      .populate("conversationId", "status")
      .populate("followUpId", "title status")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Note.countDocuments(filter),
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: notes.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    data: {
      notes,
    },
  });
});

// Get note by ID
const getNoteById = asyncwrapper(async (req, res, next) => {
  const note = await Note.findById(req.params.id)
    .populate("customerId", "name email phone")
    .populate("leadId", "title status")
    .populate("conversationId", "status")
    .populate("followUpId", "title status")
    .populate("createdBy", "name email role");

  if (!note) {
    return next(
      new AppError("Note not found", 404, HttpStatusText.FAIL),
    );
  }

  if (!hasNoteAccess(note, req.user)) {
    return next(
      new AppError(
        "You do not have permission to view this note",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      note,
    },
  });
});

// Update note
const updateNoteById = asyncwrapper(async (req, res, next) => {
  const { title, content, type } = req.body;

  const note = await Note.findById(req.params.id);
  if (!note) {
    return next(
      new AppError("Note not found", 404, HttpStatusText.FAIL),
    );
  }

  if (!hasNoteAccess(note, req.user)) {
    return next(
      new AppError(
        "You do not have permission to update this note",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  const updates = {};
  if (title !== undefined) updates.title = title ? title.trim() : null;
  if (content) updates.content = content.trim();
  if (type) updates.type = type.toUpperCase();

  const updated = await Note.findByIdAndUpdate(
    req.params.id,
    updates,
    { runValidators: true, returnDocument: "after" },
  );

  const populated = await updated.populate([
    { path: "customerId", select: "name email phone" },
    { path: "leadId", select: "title status" },
    { path: "conversationId", select: "status" },
    { path: "followUpId", select: "title status" },
    { path: "createdBy", select: "name email role" },
  ]);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Note updated successfully",
    data: {
      note: populated,
    },
  });
});

// Delete note
const deleteNoteById = asyncwrapper(async (req, res, next) => {
  const note = await Note.findById(req.params.id);
  if (!note) {
    return next(
      new AppError("Note not found", 404, HttpStatusText.FAIL),
    );
  }

  if (!hasNoteAccess(note, req.user)) {
    return next(
      new AppError(
        "You do not have permission to delete this note",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  await Note.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Note deleted successfully",
    data: null,
  });
});

module.exports = {
  createNote,
  getAllNotes,
  getNoteById,
  updateNoteById,
  deleteNoteById,
};

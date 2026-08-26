const Note = require("../models/Note.model");
const Customer = require("../models/Customer.model");
const { Lead } = require("../models/Lead.model");

const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

const { createActivity } = require("../services/activity.service");

const fullAccessRoles = ["ADMIN", "MANAGER"];

// Check if user is the creator of the note
const isNoteCreator = (note, user) => {
  return note.createdBy.toString() === user._id.toString();
};

// Check if user can access the note
const canAccessNote = async (note, user) => {
  // ADMIN / MANAGER
  if (fullAccessRoles.includes(user.role)) {
    return true;
  }

  // Note creator
  if (isNoteCreator(note, user)) {
    return true;
  }

  // Customer assigned to user
  if (note.customerId) {
    const customer = await Customer.findById(note.customerId).select(
      "assignedTo",
    );

    if (customer?.assignedTo?.toString() === user._id.toString()) {
      return true;
    }
  }

  // Lead assigned to user
  if (note.leadId) {
    const lead = await Lead.findById(note.leadId).select("assignedTo");

    if (lead?.assignedTo?.toString() === user._id.toString()) {
      return true;
    }
  }

  return false;
};

// Create note
const createNote = asyncwrapper(async (req, res, next) => {
  const { customerId, leadId, content } = req.body;

  // Must belong to Customer OR Lead
  if (!customerId && !leadId) {
    return next(
      new AppError(
        "Customer ID or Lead ID is required",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  if (customerId && leadId) {
    return next(
      new AppError(
        "Note cannot belong to both customer and lead",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }

  if (!content || !content.trim()) {
    return next(
      new AppError("Note content is required", 400, HttpStatusText.FAIL),
    );
  }

  // Check Customer
  if (customerId) {
    const customer = await Customer.findById(customerId).select("assignedTo");

    if (!customer) {
      return next(new AppError("Customer not found", 404, HttpStatusText.FAIL));
    }

    // SALES_AGENT can only add notes
    // to assigned customers
    if (
      !fullAccessRoles.includes(req.user.role) &&
      customer.assignedTo?.toString() !== req.user._id.toString()
    ) {
      return next(
        new AppError(
          "You do not have permission to add a note to this customer",
          403,
          HttpStatusText.FAIL,
        ),
      );
    }
  }

  // Check Lead
  if (leadId) {
    const lead = await Lead.findById(leadId).select("assignedTo");

    if (!lead) {
      return next(new AppError("Lead not found", 404, HttpStatusText.FAIL));
    }

    // SALES_AGENT can only add notes
    // to assigned leads
    if (
      !fullAccessRoles.includes(req.user.role) &&
      lead.assignedTo?.toString() !== req.user._id.toString()
    ) {
      return next(
        new AppError(
          "You do not have permission to add a note to this lead",
          403,
          HttpStatusText.FAIL,
        ),
      );
    }
  }

  const note = await Note.create({
    customerId: customerId || null,
    leadId: leadId || null,
    content: content.trim(),
    createdBy: req.user._id,
  });

  // Activity log
  await createActivity({
    actorId: req.user._id,
    action: "NOTE_CREATED",
    entityType: "NOTE",
    entityId: note._id,
    metadata: {
      customerId: note.customerId,
      leadId: note.leadId,
    },
  });

  await note.populate("createdBy", "name email role");

  res.status(201).json({
    status: HttpStatusText.CREATED,
    message: "Note created successfully",
    data: {
      note,
    },
  });
});

// Get all notes
const getAllNotes = asyncwrapper(async (req, res, next) => {
  const { customerId, leadId } = req.query;

  const filter = {};

  if (customerId) {
    filter.customerId = customerId;
  }

  if (leadId) {
    filter.leadId = leadId;
  }

  // SALES_AGENT access filter
  if (!fullAccessRoles.includes(req.user.role)) {
    const [customers, leads] = await Promise.all([
      Customer.find({
        assignedTo: req.user._id,
      })
        .select("_id")
        .lean(),

      Lead.find({
        assignedTo: req.user._id,
      })
        .select("_id")
        .lean(),
    ]);

    const accessFilter = {
      $or: [
        {
          createdBy: req.user._id,
        },
        {
          customerId: {
            $in: customers.map((customer) => customer._id),
          },
        },
        {
          leadId: {
            $in: leads.map((lead) => lead._id),
          },
        },
      ],
    };

    filter.$and = [accessFilter];
  }

  const notes = await Note.find(filter)
    .populate("customerId", "name email phone")
    .populate("leadId", "title status")
    .populate("createdBy", "name email role")
    .sort({
      createdAt: -1,
    })
    .lean();

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: notes.length,
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
    .populate("createdBy", "name email role");

  if (!note) {
    return next(new AppError("Note not found", 404, HttpStatusText.FAIL));
  }

  if (!(await canAccessNote(note, req.user))) {
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
  const { content } = req.body;

  if (!content || !content.trim()) {
    return next(
      new AppError("Note content is required", 400, HttpStatusText.FAIL),
    );
  }

  const note = await Note.findById(req.params.id);

  if (!note) {
    return next(new AppError("Note not found", 404, HttpStatusText.FAIL));
  }

  if (!(await canAccessNote(note, req.user))) {
    return next(
      new AppError(
        "You do not have permission to update this note",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  const oldContent = note.content;

  note.content = content.trim();

  await note.save();

  await createActivity({
    actorId: req.user._id,
    action: "NOTE_UPDATED",
    entityType: "NOTE",
    entityId: note._id,
    metadata: {
      oldContent,
      newContent: note.content,
    },
  });

  await note.populate("createdBy", "name email role");

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Note updated successfully",
    data: {
      note,
    },
  });
});

// Delete note
const deleteNoteById = asyncwrapper(async (req, res, next) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    return next(new AppError("Note not found", 404, HttpStatusText.FAIL));
  }

  if (!(await canAccessNote(note, req.user))) {
    return next(
      new AppError(
        "You do not have permission to delete this note",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }

  await createActivity({
    actorId: req.user._id,
    action: "NOTE_DELETED",
    entityType: "NOTE",
    entityId: note._id,
    metadata: {
      customerId: note.customerId,
      leadId: note.leadId,
    },
  });

  await note.deleteOne();

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

const mongoose = require("mongoose");

const Customer = require("../models/Customer.model");
const { Lead } = require("../models/Lead.model");
const { Deal } = require("../models/Deal.model");
const Conversation = require("../models/Conversation.model");
const { Message } = require("../models/Message.model");
const HttpStatusText = require("../utils/HttpStatusText");
const asyncwrapper = require("../utils/Async_Wrapper");
const AppError = require("../utils/AppError");

const MAX_LIMIT = 50;
const FULL_ACCESS_ROLES = ["ADMIN", "MANAGER"];
const SEARCH_TYPES = ["customers", "leads", "deals", "conversations"];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getSearchOptions = (req, next) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const type = req.query.type ? String(req.query.type).toLowerCase() : "all";
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
    MAX_LIMIT,
  );

  if (!query) {
    next(
      new AppError(
        "Search query parameter q is required.",
        400,
        HttpStatusText.FAIL,
      ),
    );
    return null;
  }

  if (type !== "all" && !SEARCH_TYPES.includes(type)) {
    next(
      new AppError(
        `type must be one of: ${SEARCH_TYPES.join(", ")}`,
        400,
        HttpStatusText.FAIL,
      ),
    );
    return null;
  }

  return {
    expression: new RegExp(escapeRegex(query), "i"),
    query,
    type,
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const addAuthorization = (filter, user) => {
  if (!FULL_ACCESS_ROLES.includes(user.role)) {
    filter.assignedTo = user._id;
  }
  return filter;
};

const matchingCustomerIds = async (expression) => {
  return Customer.find({
    $or: [{ name: expression }, { phone: expression }, { email: expression }],
  })
    .select("_id")
    .lean();
};

const searchCustomers = async ({ expression, skip, limit }, user) => {
  const filter = addAuthorization(
    {
      $or: [{ name: expression }, { phone: expression }, { email: expression }],
    },
    user,
  );
  const [items, total] = await Promise.all([
    Customer.find(filter)
      .select("name phone email assignedTo")
      .populate("assignedTo", "name email")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Customer.countDocuments(filter),
  ]);
  return { items, total };
};

const searchLeads = async ({ expression, query, skip, limit }, user) => {
  const customerMatches = await matchingCustomerIds(expression);
  const filter = addAuthorization(
    {
      $or: [
        { title: expression },
        { product: expression },
        { status: expression },
        ...(mongoose.Types.ObjectId.isValid(query) ? [{ _id: query }] : []),
        { customerId: { $in: customerMatches.map(({ _id }) => _id) } },
      ],
    },
    user,
  );
  const [items, total] = await Promise.all([
    Lead.find(filter)
      .populate("customerId", "name phone email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);
  return { items, total };
};

const searchDeals = async ({ expression, query, skip, limit }, user) => {
  const customerMatches = await matchingCustomerIds(expression);
  const filter = addAuthorization(
    {
      $or: [
        { title: expression },
        { stage: expression },
        ...(mongoose.Types.ObjectId.isValid(query) ? [{ _id: query }] : []),
        { customerId: { $in: customerMatches.map(({ _id }) => _id) } },
      ],
    },
    user,
  );
  const [items, total] = await Promise.all([
    Deal.find(filter)
      .populate("customerId", "name phone email")
      .populate("leadId", "title status product")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Deal.countDocuments(filter),
  ]);
  return { items, total };
};

const searchConversations = async (
  { expression, query, skip, limit },
  user,
) => {
  const customerMatches = await matchingCustomerIds(expression);
  const conversationFilter = addAuthorization(
    {
      $or: [
        { status: expression },
        ...(mongoose.Types.ObjectId.isValid(query) ? [{ _id: query }] : []),
        { customerId: { $in: customerMatches.map(({ _id }) => _id) } },
      ],
    },
    user,
  );

  const messageConversations = await Message.find({ content: expression })
    .select("conversationId")
    .lean();
  if (messageConversations.length) {
    conversationFilter.$or.push({
      _id: {
        $in: messageConversations.map(({ conversationId }) => conversationId),
      },
    });
  }

  const [items, total] = await Promise.all([
    Conversation.find(conversationFilter)
      .populate("customerId", "name phone email")
      .populate("leadId", "title status product")
      .populate("assignedTo", "name email")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(conversationFilter),
  ]);
  return { items, total };
};

const search = asyncwrapper(async (req, res, next) => {
  const options = getSearchOptions(req, next);
  if (!options) return;

  const types = options.type === "all" ? SEARCH_TYPES : [options.type];
  const searches = {
    customers: () => searchCustomers(options, req.user),
    leads: () => searchLeads(options, req.user),
    deals: () => searchDeals(options, req.user),
    conversations: () => searchConversations(options, req.user),
  };
  const entries = await Promise.all(
    types.map(async (type) => [type, await searches[type]()]),
  );
  const data = Object.fromEntries(entries);
  const total = entries.reduce((sum, [, result]) => sum + result.total, 0);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    query: options.query,
    type: options.type,
    page: options.page,
    limit: options.limit,
    total,
    data,
  });
});

module.exports = { search };

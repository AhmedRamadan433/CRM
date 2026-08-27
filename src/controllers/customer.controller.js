const Customer = require("../models/Customer.model");

const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

const customerAccessFilter = (req) =>
  req.user.role === "SALES_AGENT" ? { assignedTo: req.user._id } : {};

// Create customer
const createCustomer = asyncwrapper(async (req, res, next) => {
  const { name, email, phone, avatar, tags, source, notes } = req.body;

  const customer = await Customer.create({
    name,
    email,
    phone,
    avatar,
    tags,
    source,
    notes,
    assignedTo: req.user.role === "SALES_AGENT" ? req.user._id : undefined,
  });

  res.status(201).json({
    status: HttpStatusText.CREATED,
    message: "Customer created successfully",
    data: customer,
  });
});

// Get all customers
const getAllCustomers = asyncwrapper(async (req, res, next) => {
  const filter = customerAccessFilter(req);
  ["name", "phone", "email", "source"].forEach((field) => {
    if (req.query[field]) filter[field] = { $regex: req.query[field], $options: "i" };
  });
  if (req.query.createdAfter || req.query.createdBefore) {
    filter.createdAt = {};
    if (req.query.createdAfter) filter.createdAt.$gte = new Date(req.query.createdAfter);
    if (req.query.createdBefore) filter.createdAt.$lt = new Date(req.query.createdBefore);
  }
  const customers = await Customer.find(filter);

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: customers.length,
    data: customers,
  });
});

// Get customer by ID
const getCustomerById = asyncwrapper(async (req, res, next) => {
  const customer = await Customer.findOne({
    _id: req.params.id,
    ...customerAccessFilter(req),
  });

  if (!customer) {
    return next(new AppError("Customer not found.", 404, HttpStatusText.FAIL));
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: customer,
  });
});

// Update customer
const updateCustomerById = asyncwrapper(async (req, res, next) => {
  const { name, email, phone, avatar, tags, source, notes } = req.body;

  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, ...customerAccessFilter(req) },
    {
      name,
      email,
      phone,
      avatar,
      tags,
      source,
      notes,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!customer) {
    return next(new AppError("Customer not found.", 404, HttpStatusText.FAIL));
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: customer,
  });
});
///search by name
const searchCustomerByName = asyncwrapper(async (req, res, next) => {
  const { name } = req.query;
  if (!name) {
    return next(
      new AppError(
        "Name query parameter is required.",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }
  const customers = await Customer.find({
    ...customerAccessFilter(req),
    name: { $regex: name, $options: "i" },
  });

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: customers,
  });
});
/// search by phone
const searchCustomerByPhone = asyncwrapper(async (req, res, next) => {
  const { phone } = req.query;
  if (!phone) {
    return next(
      new AppError(
        "Phone query parameter is required.",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }
  const customers = await Customer.find({
    ...customerAccessFilter(req),
    phone: { $regex: phone, $options: "i" },
  });
  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: customers,
  });
});
//search by email
const searchCustomerByEmail = asyncwrapper(async (req, res, next) => {
  const { email } = req.query;
  if (!email) {
    return next(
      new AppError(
        "Email query parameter is required.",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }
  const customers = await Customer.find({
    ...customerAccessFilter(req),
    email: { $regex: email, $options: "i" },
  });
  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: customers,
  });
});
module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomerById,
  searchCustomerByName,
  searchCustomerByPhone,
  searchCustomerByEmail,
};

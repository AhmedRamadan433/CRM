const Customer = require("../models/Customer.model");

const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");

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
  });

  res.status(201).json({
    status: HttpStatusText.CREATED,
    message: "Customer created successfully",
    data: customer,
  });
});

// Get all customers
const getAllCustomers = asyncwrapper(async (req, res, next) => {
  const customers = await Customer.find();

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: customers.length,
    data: customers,
  });
});

// Get customer by ID
const getCustomerById = asyncwrapper(async (req, res, next) => {
  const customer = await Customer.findById(req.params.id);

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

  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
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

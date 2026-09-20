const User = require("../models/User.model");
const multer = require("multer");
const sharp = require("sharp");
const AppError = require("../utils/AppError");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");
const fs = require("fs/promises");
///////////// uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

const outputPath = "images/users";
fs.mkdir(outputPath, { recursive: true });

const resizeUserImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }
  const filename = `${req.user.id}-${Date.now()}.jpeg`;
  const filePath = `${outputPath}/${filename}`;
  const output = await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat("jpeg")
    .jpeg({ quality: 90 })
    .toFile(filePath);
  req.file.filename = filename;
  req.file.path = filePath;
  next();
};
// Create new user
const createUser = asyncwrapper(async (req, res, next) => {
  const { name, email, password, passwordConfirm, phone, role } = req.body;

  const user = await User.create({
    name,
    email,
    password,
    passwordConfirm,
    phone,
    role,
  });

  res.status(201).json({
    status: HttpStatusText.SUCCESS,
    data: {
      user,
    },
  });
});

// Get all users
const getAllUsers = asyncwrapper(async (req, res, next) => {
  const users = await User.find();

  if (users.length === 0) {
    return next(new AppError("No users found.", 404, HttpStatusText.ERROR));
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    results: users.length,
    data: {
      users,
    },
  });
});

// Get user by ID
const getUserById = asyncwrapper(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError("User not found.", 404, HttpStatusText.ERROR));
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      user,
    },
  });
});

// Update user by ID
const updateUserById = asyncwrapper(async (req, res, next) => {
  const { name, email, phone } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      name,
      email,
      phone,
      avatar: req.file ? req.file.filename : undefined,
    },
    {
      runValidators: true,
      returnDocument: "after",
    },
  );

  if (!user) {
    if (req.file) {
      await fs.unlink(req.file.path);
    }
    return next(new AppError("User not found.", 404, HttpStatusText.FAIL));
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      user,
    },
  });
});

// Deactivate user by ID
const deactivateUserById = asyncwrapper(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      status: "INACTIVE",
    },
    {
      runValidators: true,
      returnDocument: "after",
    },
  );

  if (!user) {
    return next(new AppError("User not found.", 404, HttpStatusText.ERROR));
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      user,
    },
  });
});

// Assign role to user by ID
const assignRoleToUserById = asyncwrapper(async (req, res, next) => {
  const { role } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      role,
    },
    {
      runValidators: true,
      returnDocument: "after",
    },
  );

  if (!user) {
    return next(new AppError("User not found.", 404, HttpStatusText.ERROR));
  }

  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      user,
    },
  });
});

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUserById,
  deactivateUserById,
  assignRoleToUserById,
  resizeUserImage,
  upload,
};

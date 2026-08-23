const User = require("../models/User.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const AppError = require("../utils/AppError");
const { promisify } = require("util");
const asyncwrapper = require("../utils/Async_Wrapper");
const HttpStatusText = require("../utils/HttpStatusText");
/// Register a new user
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const register = asyncwrapper(async (req, res, next) => {
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    phone: req.body.phone,
    role: "SALES_AGENT",
  });

  const token = signToken(user._id);

  res.status(201).json({
    status: HttpStatusText.SUCCESS,
    data: {
      token,
    },
  });
});
//// Sign in user
const signIn = asyncwrapper(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(
      new AppError(
        "Please provide email and password",
        400,
        HttpStatusText.FAIL,
      ),
    );
  }
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(
      new AppError("Incorrect email or password", 401, HttpStatusText.FAIL),
    );
  }
  if (user.status === "INACTIVE") {
    return next(
      new AppError(
        "Your account is inactive. Please contact support.",
        403,
        HttpStatusText.FAIL,
      ),
    );
  }
  const token = signToken(user._id);
  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    data: {
      token,
    },
  });
});
//// logout user
const logout = asyncwrapper(async (req, res, next) => {
  res.status(200).json({
    status: HttpStatusText.SUCCESS,
    message: "Logged out successfully",
  });
});
module.exports = {
  register,
  signIn,
  logout,
};

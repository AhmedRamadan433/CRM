const User = require("../models/User.model");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const AppError = require("../utils/AppError");

const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // No token
    if (!token) {
      return next(
        new AppError(
          "You are not logged in! Please log in to get access.",
          401,
        ),
      );
    }

    // Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // Check if user still exists
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return next(
        new AppError("The user belonging to this token no longer exists.", 401),
      );
    }

    // Check if user is inactive
    if (currentUser.status === "INACTIVE") {
      return next(new AppError("Your account is inactive.", 403));
    }

    // Attach user to request
    req.user = currentUser;

    next();
  } catch (err) {
    return next(
      new AppError("Invalid or expired token. Please log in again.", 401),
    );
  }
};

module.exports = protect;

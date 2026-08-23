class AppError extends Error {
  constructor(message, statusCode = 500, statustext = "Error") {
    super(message);
    this.statusCode = statusCode;
    this.statustext = statustext;
  }
}
module.exports = AppError;

const express = require("express");
const app = express();
const cors = require("cors");
const All_Routes = require("./routes/All_Routes");
app.use(cors());
app.use(express.json());
app.use("/images", express.static("images"));
/// routes
app.use("/", All_Routes);
/////////error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || "error";
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({
    status,
    message,
  });
});
module.exports = app;

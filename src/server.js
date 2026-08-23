const app = require("./app");
require("dotenv").config();
const connectDB = require("./config/database");
connectDB();
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});

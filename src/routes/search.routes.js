const express = require("express");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");
const { search } = require("../controllers/search.controller");

const router = express.Router();

router.use(protect);
router.get("/", restrictTo("ADMIN", "MANAGER", "SALES_AGENT"), search);

module.exports = router;

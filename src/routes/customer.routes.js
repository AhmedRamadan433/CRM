const customerController = require("../controllers/customer.controller");
const express = require("express");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);
router.use(restrictTo("ADMIN", "MANAGER", "SALES_AGENT"));
// Search routes — keep these BEFORE /:id
router.get("/search/name", customerController.searchCustomerByName);

router.get("/search/phone", customerController.searchCustomerByPhone);

router.get("/search/email", customerController.searchCustomerByEmail);

// Customer routes
router
  .route("/")
  .post(customerController.createCustomer)
  .get(customerController.getAllCustomers);

router
  .route("/:id")
  .get(customerController.getCustomerById)
  .patch(customerController.updateCustomerById);

module.exports = router;

const leadcontroller = require("../controllers/lead.controller");

const express = require("express");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");
const router = express.Router();
router.use(protect, restrictTo("ADMIN", "MANAGER", "SALES_AGENT"));
////
router
  .route("/")
  .post(leadcontroller.createLead)
  .get(leadcontroller.getAllLeads);
//// id
router
  .route("/:id")
  .get(leadcontroller.getLeadById)
  .patch(leadcontroller.updateLeadById);
/// assign lead
router.patch(
  "/:id/assign",
  restrictTo("ADMIN", "MANAGER"),
  leadcontroller.assignLeadToUser,
);
/// change lead status
router.patch("/:id/status", leadcontroller.changeLeadStatus);
////
module.exports = router;

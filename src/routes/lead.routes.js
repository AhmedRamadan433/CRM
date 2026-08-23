const leadcontroller = require("../controllers/lead.controller");

const express = require("express");
const router = express.Router();
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
router.patch("/:id/assign", leadcontroller.assignLeadToUser);
/// change lead status
router.patch("/:id/status", leadcontroller.changeLeadStatus);
////
module.exports = router;

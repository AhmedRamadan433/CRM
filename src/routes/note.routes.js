const express = require("express");
const noteController = require("../controllers/note.controller");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);
router.use(restrictTo("ADMIN", "MANAGER", "SALES_AGENT"));

router
  .route("/")
  .post(noteController.createNote)
  .get(noteController.getAllNotes);

router
  .route("/:id")
  .get(noteController.getNoteById)
  .patch(noteController.updateNoteById)
  .delete(noteController.deleteNoteById);

module.exports = router;

const userController = require("../controllers/user.controller");
const express = require("express");
const protect = require("../middleware/auth.middleware");
const restrictTo = require("../middleware/role.middleware");

const router = express.Router();
router.use(protect);
router
  .route("/")
  .post(restrictTo("ADMIN"), userController.createUser)
  .get(restrictTo("ADMIN", "MANAGER"), userController.getAllUsers);

router
  .route("/:id")
  .get(restrictTo("ADMIN", "MANAGER"), userController.getUserById)
  .patch(restrictTo("ADMIN"), userController.updateUserById)
  .delete(restrictTo("ADMIN"), userController.deactivateUserById);

router.patch(
  "/:id/role",

  restrictTo("ADMIN"),
  userController.assignRoleToUserById,
);

module.exports = router;

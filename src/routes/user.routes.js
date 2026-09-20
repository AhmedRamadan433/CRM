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
  .patch(
    restrictTo("ADMIN"),
    userController.upload.single("avatar"),
    userController.resizeUserImage,
    userController.updateUserById,
  );

router.patch(
  "/:id/deactivate",
  restrictTo("ADMIN"),
  userController.deactivateUserById,
);

router.patch(
  "/:id/role",

  restrictTo("ADMIN"),
  userController.assignRoleToUserById,
);

module.exports = router;

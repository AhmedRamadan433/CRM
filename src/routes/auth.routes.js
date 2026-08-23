const { register, signIn, logout } = require("../controllers/auth.controller");

const express = require("express");

const router = express.Router();

router.post("/register", register);
router.post("/login", signIn);
router.post("/logout", logout);

module.exports = router;

import express from "express";
import * as authController from "../controllers/authController.js";

const router = express.Router();

// Auth Routes
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/me", authController.getMe);
router.post("/logout", authController.logout);

// Password Reset Routes
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

export default router;
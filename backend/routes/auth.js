import express from "express";
import {
  signup,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  sendVerification,
  verifyEmail,
  checkVerificationStatus,
  resendVerification
} from "../controllers/authController.js";

const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// ============================================
// AUTH ROUTES
// ============================================

// Signup
router.post("/signup", signup);

// Login
router.post("/login", login);

// Get current user
router.get("/me", getMe);

// Logout
router.post("/logout", logout);

// Forgot password
router.post("/forgot-password", forgotPassword);

// Reset password
router.post("/reset-password", resetPassword);

// ============================================
// EMAIL VERIFICATION ROUTES
// ============================================

// Send verification email
router.post("/send-verification", requireAuth, sendVerification);

// Verify email with token
router.post("/verify-email", verifyEmail);

// Check verification status
router.get("/verification-status", requireAuth, checkVerificationStatus);

// Resend verification email
router.post("/resend-verification", requireAuth, resendVerification);

export default router;
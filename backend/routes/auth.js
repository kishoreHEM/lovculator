import express from "express";
import pool from "../db.js";
import { calculateProfileCompletion } from "../utils/profileCompletion.js";
import rateLimit from "express-rate-limit";

import {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  sendVerification,
  verifyEmail,
  checkVerificationStatus,
  resendVerification
} from "../controllers/authController.js";

const router = express.Router();

/* ======================================================
   🔒 RATE LIMITERS
====================================================== */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { error: "Too many authentication attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: "Too many password reset requests. Please try again after an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ======================================================
   🔒 AUTH MIDDLEWARE
====================================================== */
const requireAuth = (req, res, next) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: req.session.user.id };
  next();
};

/* ======================================================
   AUTH ROUTES
====================================================== */

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPassword);

/* ======================================================
   🔐 CURRENT USER (WITH PROFILE COMPLETION)
====================================================== */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        username,
        display_name,
        bio,
        location,
        relationship_status,
        gender,
        date_of_birth,
        work_education,
        avatar_url,
        follower_count,
        following_count,
        created_at
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];

    // ✅ compute completion dynamically
    user.profile_completion = calculateProfileCompletion(user);

    res.json({ user });

  } catch (err) {
    console.error("❌ auth/me error:", err);
    res.status(500).json({ error: "Failed to load session" });
  }
});

/* ======================================================
   EMAIL VERIFICATION
====================================================== */

router.post("/send-verification", requireAuth, sendVerification);
router.post("/verify-email", verifyEmail);
router.get("/verification-status", requireAuth, checkVerificationStatus);
router.post("/resend-verification", requireAuth, resendVerification);

export default router;

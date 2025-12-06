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

// ============================================
// EMAILJS TEST ENDPOINTS (FOR DEBUGGING)
// ============================================

// Test EmailJS connection
router.get("/test-emailjs", async (req, res) => {
  try {
    const { testEmailJSConnection } = await import("../routes/emailService.js");
    const result = await testEmailJSConnection();
    res.json({
      success: result.success,
      message: result.message,
      status: result.status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ EmailJS test error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      note: "Check Railway variables: EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY"
    });
  }
});

// Test email sending (requires auth)
router.post("/test-send-email", requireAuth, async (req, res) => {
  try {
    const { sendVerificationEmail } = await import("../routes/emailService.js");
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({ error: "testEmail is required" });
    }
    
    const testToken = "test-" + Date.now();
    const sent = await sendVerificationEmail(testEmail, testToken, "TestUser");
    
    if (sent) {
      res.json({
        success: true,
        message: `Test email sent to ${testEmail}`,
        test_token: testToken,
        verification_url: `https://lovculator.com/verify-email.html?token=${testToken}`
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: "Failed to send test email",
        check: "Verify EmailJS credentials in Railway variables"
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
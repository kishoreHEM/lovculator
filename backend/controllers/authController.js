import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../db.js";
// Adjust this path if emailService is located elsewhere
import { sendPasswordResetEmail } from "../routes/emailService.js"; 

// ===================================================
// 1️⃣ SIGNUP
// ===================================================
export const signup = async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    email = email.trim().toLowerCase();

    const existingUser = await pool.query(
      "SELECT 1 FROM users WHERE email = $1",
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, username, email`,
      [username, email, hashedPassword]
    );

    const newUser = result.rows[0];
    req.session.user = newUser;

    res.status(201).json({
      message: "Signup successful 🎉",
      user: newUser,
    });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Failed to register user." });
  }
};

// ===================================================
// 2️⃣ LOGIN
// ===================================================
export const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email/Username and password required." });
    }

    email = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, username, email, password_hash
       FROM users
       WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
    };

    req.session.save((err) => {
      if (err) {
        console.error("❌ Session save failed:", err);
        return res.status(500).json({ error: "Failed to save session." });
      }
      res.status(200).json({
        message: "Login successful ✅",
        user: req.session.user,
      });
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Failed to log in." });
  }
};

// ===================================================
// 3️⃣ GET CURRENT USER (ME)
// ===================================================
export const getMe = async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, user: null });
    }

    const result = await pool.query(
      `SELECT 
          id, username, display_name, email, avatar_url,
          follower_count, following_count, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, user: null });
    }

    const user = result.rows[0];
    // Refresh session data
    req.session.user = { id: user.id, username: user.username, email: user.email };

    res.json({
      success: true,
      user: {
        ...user,
        avatar_url: user.avatar_url && user.avatar_url !== "null" ? user.avatar_url : "/images/default-avatar.png",
      }
    });

  } catch (err) {
    console.error("❌ /me error:", err);
    res.status(500).json({ success: false, error: "Failed to load user info" });
  }
};

// ===================================================
// 4️⃣ LOGOUT
// ===================================================
export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Logout failed:", err);
      return res.status(500).json({ error: "Logout failed." });
    }

    // Clear session cookie correctly
    res.clearCookie("connect.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  });
};


// ===================================================
// 5️⃣ FORGOT PASSWORD
// ===================================================
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    const user = result.rows[0];

    if (!user) {
      return res.status(200).json({ message: "If this email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
      [user.id, token, expiresAt]
    );

    await sendPasswordResetEmail(normalizedEmail, token);

    res.status(200).json({ message: "If this email exists, a reset link has been sent." });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ error: "Server error." });
  }
};

// ===================================================
// 6️⃣ RESET PASSWORD
// ===================================================
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Invalid request or password too short." });
  }

  try {
    const resetResult = await pool.query(
      "SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()",
      [token]
    );
    const resetEntry = resetResult.rows[0];

    if (!resetEntry) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("BEGIN");
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashedPassword, resetEntry.user_id]);
    await pool.query("DELETE FROM password_resets WHERE user_id = $1", [resetEntry.user_id]);
    await pool.query("COMMIT");

    res.status(200).json({ message: "Password successfully reset. You can now log in." });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
};

// ============================================
// EMAIL VERIFICATION ROUTES
// ============================================

// 1️⃣ Send verification email (after signup)
router.post("/send-verification", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Check if already verified
    const userRes = await pool.query(
      "SELECT email, email_verified FROM users WHERE id = $1",
      [userId]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = userRes.rows[0];
    
    if (user.email_verified) {
      return res.status(400).json({ error: "Email already verified" });
    }
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Save token to database
    await pool.query(
      "UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3",
      [verificationToken, tokenExpires, userId]
    );
    
    // Send verification email
    const verificationLink = `https://lovculator.com/verify-email?token=${verificationToken}`;
    
    // TODO: Implement email sending (using nodemailer, SendGrid, etc.)
    await sendVerificationEmail(user.email, verificationLink);
    
    res.json({
      success: true,
      message: "Verification email sent successfully"
    });
    
  } catch (err) {
    console.error("❌ Error sending verification email:", err.message);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

// 2️⃣ Verify email with token
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }
    
    // Find user by token
    const userRes = await pool.query(
      `SELECT id, email_verified, verification_token_expires 
       FROM users 
       WHERE verification_token = $1`,
      [token]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired verification token" });
    }
    
    const user = userRes.rows[0];
    
    // Check if already verified
    if (user.email_verified) {
      return res.status(400).json({ error: "Email already verified" });
    }
    
    // Check if token expired
    if (new Date() > new Date(user.verification_token_expires)) {
      return res.status(400).json({ error: "Verification token has expired" });
    }
    
    // Mark email as verified
    await pool.query(
      `UPDATE users 
       SET email_verified = TRUE, 
           verified_at = NOW(),
           verification_token = NULL,
           verification_token_expires = NULL
       WHERE id = $1`,
      [user.id]
    );
    
    res.json({
      success: true,
      message: "Email verified successfully! You can now log in."
    });
    
  } catch (err) {
    console.error("❌ Error verifying email:", err.message);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

// 3️⃣ Check verification status
router.get("/verification-status", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const userRes = await pool.query(
      "SELECT email_verified, verified_at FROM users WHERE id = $1",
      [userId]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({
      email_verified: userRes.rows[0].email_verified,
      verified_at: userRes.rows[0].verified_at
    });
    
  } catch (err) {
    console.error("❌ Error checking verification status:", err.message);
    res.status(500).json({ error: "Failed to check verification status" });
  }
});

// 4️⃣ Update login to check verification
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // ... existing login code ...
    
    // AFTER finding user and verifying password, add this check:
    const user = userRes.rows[0];
    
    if (!user.email_verified) {
      return res.status(403).json({ 
        error: "Please verify your email before logging in",
        needs_verification: true,
        user_id: user.id
      });
    }
    
    // ... rest of login logic ...
    
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// 5️⃣ Update signup to send verification email automatically
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // ... existing signup code ...
    
    // AFTER successful user creation, send verification email
    const newUser = insertRes.rows[0];
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await pool.query(
      "UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3",
      [verificationToken, tokenExpires, newUser.id]
    );
    
    // Send verification email
    const verificationLink = `https://lovculator.com/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(email, verificationLink);
    
    res.json({
      success: true,
      message: "Signup successful! Please check your email to verify your account.",
      user: newUser,
      needs_verification: true
    });
    
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});
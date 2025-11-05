import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto"; // Needed for secure token generation
import pool from "../db.js"; // Your database pool
import { sendPasswordResetEmail } from './emailService.js'; // Assumes this file is in the same directory

// ===================================================
// ✅ 0. ROUTER INITIALIZATION (FIXED: ReferenceError)
// ===================================================
const router = express.Router();

// ===================================================
// 1️⃣ SIGNUP / REGISTER (FIXED: 404 Mismatch)
// ===================================================
// Changed from '/register' to '/signup' to match frontend call
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: "All fields are required." });

    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (existingUser.rows.length > 0)
      return res.status(400).json({ error: "Email already registered." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, hashedPassword]
    );

    const newUser = result.rows[0];
    req.session.user = newUser;

    res.status(201).json({ message: "Signup successful", user: newUser });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// ===================================================
// 2️⃣ LOGIN (FIXED: 500 Internal Server Error)
// ===================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required." });

    // ✅ FIX: Explicitly selecting 'password' to prevent bcrypt crash
    const result = await pool.query(
      "SELECT id, username, email, password FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: "Invalid credentials." }); // Use generic message for security

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ error: "Invalid credentials." });

    req.session.user = { id: user.id, username: user.username, email: user.email };

    res.status(200).json({ message: "Login successful", user: req.session.user });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Failed to log in" });
  }
});

// ===================================================
// 3️⃣ AUTH CHECK (/api/auth/me)
// ===================================================
router.get("/me", (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

// ===================================================
// 4️⃣ LOGOUT
// ===================================================
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Logout failed:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.status(204).send();
  });
});

// ===================================================
// 5️⃣ FORGOT PASSWORD - STEP 1 (Generate Token & Email)
// ===================================================
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    try {
        const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        const user = result.rows[0];

        // Security: Fail silently to prevent user enumeration
        if (!user) {
            return res.status(200).json({ message: "If an account with that email exists, a reset link has been sent." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        // Insert/Update token, using ON CONFLICT to handle multiple requests
        await pool.query(
            `INSERT INTO password_resets (user_id, token, expires_at) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (user_id) DO UPDATE 
             SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
            [user.id, token, expiresAt]
        );

        // Send Email
        await sendPasswordResetEmail(email, token);

        res.status(200).json({ message: "If an account with that email exists, a reset link has been sent." });

    } catch (err) {
        console.error("❌ Forgot password error:", err);
        res.status(500).json({ error: "Server error during password reset request." });
    }
});

// ===================================================
// 6️⃣ FORGOT PASSWORD - STEP 2 (Token Validation & Reset)
// ===================================================
router.post("/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Invalid request or password too short." });
    }

    try {
        // 1. Find the token, validate against NOW(), and get user_id
        const resetResult = await pool.query(
            "SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()",
            [token]
        );
        const resetEntry = resetResult.rows[0];

        if (!resetEntry) {
            return res.status(400).json({ error: "Invalid or expired reset token." });
        }

        const userId = resetEntry.user_id;

        // 2. Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 3. Perform Update and Cleanup as a Transaction
        await pool.query("BEGIN");

        // Update password
        await pool.query(
            "UPDATE users SET password = $1 WHERE id = $2",
            [hashedPassword, userId]
        );

        // Delete the token to prevent reuse
        await pool.query(
            "DELETE FROM password_resets WHERE user_id = $1",
            [userId]
        );

        await pool.query("COMMIT");

        res.status(200).json({ message: "Password successfully reset. You can now log in." });

    } catch (err) {
        await pool.query("ROLLBACK");
        console.error("❌ Reset password error:", err);
        res.status(500).json({ error: "Failed to reset password." });
    }
});

// ===================================================
// ✅ FINAL EXPORT (FIXED: Default Export)
// ===================================================
export default router;
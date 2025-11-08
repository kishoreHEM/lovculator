// backend/routes/auth.js

import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../db.js";
import { sendPasswordResetEmail } from "./emailService.js";

const router = express.Router();

// ===================================================
// 1️⃣ USER SIGNUP / REGISTER
// ===================================================
router.post("/signup", async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Normalize email (avoid duplicates with case differences)
    email = email.trim().toLowerCase();

    // ✅ Check if user already exists
    const existingUser = await pool.query(
      "SELECT 1 FROM users WHERE email = $1",
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered." });
    }

    // ✅ Securely hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Insert new user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, username, email`,
      [username, email, hashedPassword]
    );

    const newUser = result.rows[0];

    // ✅ Start session
    req.session.user = newUser;

    res.status(201).json({
      message: "Signup successful 🎉",
      user: newUser,
    });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Failed to register user." });
  }
});

// ===================================================
// 2️⃣ LOGIN
// ===================================================
// ===================================================
// 2️⃣ LOGIN — Supports Username OR Email
// ===================================================
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email or username and password required." });
    }

    // Normalize input
    email = email.trim().toLowerCase();

    // ✅ Allow login by username OR email (case-insensitive)
    const result = await pool.query(
      `SELECT id, username, email, password_hash
       FROM users
       WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid email/username or password." });
    }

    // ✅ Verify password hash
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email/username or password." });
    }

    // ✅ Save minimal session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
    };

    res.status(200).json({
      message: "Login successful ✅",
      user: req.session.user,
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Failed to log in." });
  }
});


// ===================================================
// 3️⃣ AUTH CHECK (/api/auth/me) — FIXED VERSION
// ===================================================
router.get("/me", async (req, res) => {
  const userId = req.session?.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Not logged in." });
  }

  try {
    // Fetch latest user data from DB
    const result = await pool.query(
      `SELECT id, username, email, display_name, bio, location, relationship_status,
              follower_count, following_count, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = result.rows[0];

    // Optionally, refresh session cache too
    req.session.user = user;

    res.json(user);
  } catch (err) {
    console.error("❌ Error in /auth/me:", err);
    res.status(500).json({ error: "Failed to fetch user details." });
  }
});

// ===================================================
// 4️⃣ LOGOUT
// ===================================================
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Logout failed:", err);
      return res.status(500).json({ error: "Logout failed." });
    }
    res.clearCookie("connect.sid");
    res.status(204).send();
  });
});

// ===================================================
// 5️⃣ FORGOT PASSWORD (Request Reset Link)
// ===================================================
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query("SELECT id FROM users WHERE email = $1", [
      normalizedEmail,
    ]);
    const user = result.rows[0];

    // Security: always return success message even if user doesn't exist
    if (!user) {
      return res
        .status(200)
        .json({ message: "If this email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // ✅ Upsert token into password_resets
    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
      [user.id, token, expiresAt]
    );

    // ✅ Send email (optional, requires working emailService)
    await sendPasswordResetEmail(normalizedEmail, token);

    res
      .status(200)
      .json({ message: "If this email exists, a reset link has been sent." });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res
      .status(500)
      .json({ error: "Server error during password reset request." });
  }
});

// ===================================================
// 6️⃣ RESET PASSWORD (Using Token)
// ===================================================
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ error: "Invalid request or password too short." });
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

    const userId = resetEntry.user_id;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("BEGIN");

    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      hashedPassword,
      userId,
    ]);

    await pool.query("DELETE FROM password_resets WHERE user_id = $1", [
      userId,
    ]);

    await pool.query("COMMIT");

    res
      .status(200)
      .json({ message: "Password successfully reset. You can now log in." });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

export default router;

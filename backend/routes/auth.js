// backend/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js"; // ✅ Shared DB connection (from backend/db.js)

const router = express.Router();

// ======================================================
// 1️⃣ USER REGISTRATION
// ======================================================
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Check if username or email already exists
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE username = $1 OR email = $2`,
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "Username or email already exists. Please try another." });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username, email, hashedPassword]
    );

    const newUser = result.rows[0];

    // ✅ Save session
    req.session.userId = newUser.id;
    req.session.username = newUser.username;

    // Make sure session is persisted before responding
    req.session.save((err) => {
      if (err) {
        console.error("⚠️ Session save error:", err);
        return res.status(500).json({ error: "Session could not be saved." });
      }
      console.log(`✅ New user registered: ${username}`);
      res.status(201).json({
        message: "Registration successful",
        user: newUser,
      });
    });
  } catch (err) {
    if (err.code === "23505") {
      console.error("❌ Duplicate username or email:", err.detail);
      return res.status(409).json({
        error: "Username or email already exists. Please try another.",
      });
    }

    console.error("❌ Registration error details:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// ======================================================
// 2️⃣ USER LOGIN
// ======================================================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    const userResult = await pool.query(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );

    const user = userResult.rows[0];
    if (!user)
      return res.status(401).json({ error: "Invalid username or password" });

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch)
      return res.status(401).json({ error: "Invalid username or password" });

    // ✅ Save user session
    req.session.userId = user.id;
    req.session.username = user.username;

    req.session.save((err) => {
      if (err) {
        console.error("⚠️ Session save error:", err);
        return res.status(500).json({ error: "Session could not be saved." });
      }
      console.log(`✅ User logged in: ${username}`);
      res.json({
        message: "Login successful",
        user: { id: user.id, username: user.username, email: user.email },
      });
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ======================================================
// 3️⃣ USER LOGOUT
// ======================================================
router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("❌ Error destroying session:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      console.log("✅ User logged out successfully");
      return res.json({ message: "Logout successful" });
    });
  } else {
    res.json({ message: "No active session" });
  }
});

// ======================================================
// 4️⃣ CHECK SESSION
// ======================================================
router.get("/session", (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      loggedIn: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
      },
    });
  } else {
    res.json({ loggedIn: false });
  }
});

export default router;

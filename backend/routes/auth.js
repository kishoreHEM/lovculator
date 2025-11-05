// backend/routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";

const router = express.Router();

// ===================================================
// 1️⃣ REGISTER / SIGNUP
// ===================================================
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: "All fields are required." });

    // Check existing user
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
    req.session.user = newUser; // ✅ Create session immediately after signup
    console.log("✅ Session created after signup:", req.session.user);

    res.status(201).json({ message: "Signup successful", user: newUser });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// ===================================================
// 2️⃣ LOGIN (Create Session + Send Cookie)
// ===================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required." });

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found." });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ error: "Invalid credentials." });

    // ✅ Create session cookie
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
    };

    console.log("✅ Session created after login:", req.session.user);

    // ✅ Make sure cookie is sent to frontend
    res.status(200).json({
      message: "Login successful",
      user: req.session.user,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Failed to log in" });
  }
});

// ===================================================
// 3️⃣ AUTH CHECK (Frontend Calls /auth/me)
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

export default router;

// backend/routes/users.js
import express from "express";
import pool from "../db.js"; // ✅ shared connection

const router = express.Router();

// ======================================================
// 1️⃣ FETCH ALL USERS (Public Info Only)
// ======================================================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, display_name, bio, location, relationship_status, 
              follower_count, following_count
       FROM users
       ORDER BY id ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ======================================================
// 2️⃣ FETCH SINGLE USER BY USERNAME
// ======================================================
router.get("/:username", async (req, res) => {
  try {
    const username = req.params.username;

    const result = await pool.query(
      `SELECT id, username, email, display_name, bio, location, relationship_status,
              follower_count, following_count
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Fetch user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ======================================================
// 3️⃣ UPDATE USER PROFILE (Requires Auth)
// ======================================================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, bio, location, relationship_status } = req.body;
    const sessionUserId = req.session?.userId;

    if (!sessionUserId || parseInt(id) !== sessionUserId) {
      return res.status(403).json({ error: "Unauthorized action" });
    }

    const result = await pool.query(
      `UPDATE users 
       SET display_name = $1, bio = $2, location = $3, relationship_status = $4
       WHERE id = $5
       RETURNING id, username, display_name, bio, location, relationship_status`,
      [display_name, bio, location, relationship_status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating profile:", err);
    res.status(500).json({ error: "Profile update failed" });
  }
});

// ======================================================
// 4️⃣ FOLLOW / UNFOLLOW (Future Feature Placeholder)
// ======================================================
router.post("/:id/follow", (req, res) => {
  res.json({ message: "Follow feature coming soon!" });
});

router.delete("/:id/unfollow", (req, res) => {
  res.json({ message: "Unfollow feature coming soon!" });
});

export default router;

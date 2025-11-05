// backend/routes/stories.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ✅ Fetch all stories
router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        user_id, 
        story_title, 
        love_story, 
        couple_names,
        likes_count, 
        comments_count, 
        created_at, 
        updated_at
      FROM stories
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch stories error:", err.message);
    res.status(500).json({ error: "Failed to fetch stories" });
  }
});

// ✅ Fetch a single story by ID (optional)
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM stories WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Story not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Story fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch story" });
  }
});

export default router;

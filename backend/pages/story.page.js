import express from "express";
import pool from "../db.js";

const router = express.Router();

// ✅ FIX: Added (\\d+) to ensure ID is strictly numeric
// This prevents the hyphens in the slug from confusing the parser
router.get("/stories/:id(\\d+)-:slug(*)?", async (req, res, next) => {
  const storyId = Number(req.params.id);

  if (Number.isNaN(storyId)) {
    // Pass to next middleware (let the frontend handle 404 page)
    return next();
  }

  try {
    const { rows } = await pool.query(`
      SELECT
        s.*,
        u.username,
        u.display_name,
        u.avatar_url
      FROM stories s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
    `, [storyId]);

    if (!rows.length) {
      // If story not found in DB, let generic 404 handler catch it
      return next(); 
    }

    res.render("story-detail", { story: rows[0] });
  } catch (err) {
    console.error("Story page error:", err);
    res.status(500).send("Server error");
  }
});

export default router;
import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/stories/:id(\\d+)-:slug(*)?", async (req, res, next) => {
  const storyId = Number(req.params.id);
  
  // ✅ FIX: server.js uses express-session, so we look in req.session.user
  const sessionUser = req.session?.user || null;
  const currentUserId = sessionUser ? sessionUser.id : null;

  if (Number.isNaN(storyId)) return next();

  try {
    const { rows } = await pool.query(`
      SELECT
        s.*,
        u.username,
        u.display_name,
        u.avatar_url,
        (SELECT COUNT(*) FROM story_likes WHERE story_id = s.id) as likes_count,
        (SELECT COUNT(*) FROM story_comments WHERE story_id = s.id) as comments_count,
        EXISTS(SELECT 1 FROM story_likes WHERE story_id = s.id AND user_id = $2) as user_liked
      FROM stories s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
    `, [storyId, currentUserId]);

    if (!rows.length) return next();

    res.render("story-detail", { 
        story: rows[0],
        user: sessionUser // Pass the session user to EJS
    });

  } catch (err) {
    console.error("Story page error:", err);
    res.status(500).send("Server error");
  }
});

export default router;
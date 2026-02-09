import express from "express";
import pool from "../db.js";

const router = express.Router();

const slugify = (text = "") => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 180);
};

router.get("/stories/:slug", async (req, res, next) => {
  const slugParam = req.params.slug;
  const storyId = /^\d+$/.test(slugParam) ? Number(slugParam) : null;
  
  // ✅ FIX: server.js uses express-session, so we look in req.session.user
  const sessionUser = req.session?.user || null;
  const currentUserId = sessionUser ? sessionUser.id : null;

  if (storyId !== null && Number.isNaN(storyId)) return next();

  try {
    const query = storyId
      ? `
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
        LIMIT 1
      `
      : `
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
        WHERE trim(both '-' from regexp_replace(lower(s.story_title), '[^a-z0-9]+', '-', 'g')) = $1
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

    const { rows } = await pool.query(query, [storyId ?? slugParam, currentUserId]);

    if (!rows.length) return next();

    const story = rows[0];
    story.story_title_slug = slugify(story.story_title || "");

    res.render("story-detail", { 
        story,
        user: sessionUser // Pass the session user to EJS
    });

  } catch (err) {
    console.error("Story page error:", err);
    res.status(500).send("Server error");
  }
});

export default router;

import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================================================
// 1️⃣ FETCH ALL LOVE STORIES & STORIES BY USER ID
// ======================================================
// Note: You had two nearly identical GET routes, consolidating them here.
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query; // Check if a specific user ID is requested

    let query = `
      SELECT 
        id,
        user_id,
        story_title,
        couple_names,
        love_story,
        category,
        mood,
        likes_count,
        comments_count,
        created_at,
        updated_at
      FROM stories
    `;
    let values = [];

    if (userId) {
      query += " WHERE user_id = $1";
      values.push(userId);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, values);

    console.log(`✅ ${result.rowCount} stories fetched`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch stories error:", err.message);
    res.status(500).json({ error: "Failed to fetch stories" });
  }
});

// ======================================================
// 2️⃣ CREATE NEW STORY (Requires Auth)
// ======================================================
router.post("/", async (req, res) => {
  try {
    const { story_title, couple_names, love_story, category, mood } = req.body;
    
    // 🔑 CRITICAL FIX: Access user ID from the correct session object
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "You must be logged in to post a story." });
    }

    if (!story_title || !love_story) {
      return res.status(400).json({ error: "Story title and content are required." });
    }

    const result = await pool.query(
      `INSERT INTO stories 
        (user_id, story_title, couple_names, love_story, category, mood, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [userId, story_title, couple_names, love_story, category, mood]
    );

    console.log(`✅ New story added by user ${userId}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creating story:", err.message);
    res.status(500).json({ error: "Failed to post story" });
  }
});

// ======================================================
// 3️⃣ LIKE A STORY (Requires Auth)
// ======================================================
router.post("/:id/like", async (req, res) => {
  try {
    const storyId = req.params.id;
    
    // 🔑 CRITICAL FIX: Access user ID from the correct session object
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "You must be logged in to like stories." });
    }
    
    // Optional: Check if user has already liked the story (advanced logic)
    // We proceed here with a simple increment based on your provided code:

    const result = await pool.query(
      `UPDATE stories 
       SET likes_count = COALESCE(likes_count, 0) + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [storyId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Story not found" });
    }

    console.log(`❤️ Story ${storyId} liked by user ${userId}`);
    res.json({ message: "Story liked successfully", story: result.rows[0] });
  } catch (err) {
    console.error("❌ Error liking story:", err.message);
    res.status(500).json({ error: "Failed to like story" });
  }
});

export default router;
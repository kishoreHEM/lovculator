import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================================================
// 1️⃣ FETCH ALL LOVE STORIES & STORIES BY USER ID
// ======================================================
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query; 

    // 🔑 FIX: Ensure all columns are present and correctly ordered with commas.
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
        allow_comments,  -- MUST be here for frontend rendering
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
    // Send a 500 status to indicate server failure
    res.status(500).json({ error: "Failed to fetch stories" });
  }
});

// ======================================================
// 2️⃣ CREATE NEW STORY (Requires Auth)
// ======================================================
router.post("/", async (req, res) => {
  try {
    // 🔑 FIX: Ensure 'allowComments' is destructured
    const { 
        story_title, 
        couple_names, 
        love_story, 
        category, 
        mood, 
        allowComments 
    } = req.body;
    
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "You must be logged in to post a story." });
    }

    if (!story_title || !love_story) {
      return res.status(400).json({ error: "Story title and content are required." });
    }

    // 🔑 FIX: Correctly insert all fields, including allow_comments
    const result = await pool.query(
      `INSERT INTO stories 
        (user_id, story_title, couple_names, love_story, category, mood, allow_comments, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [userId, story_title, couple_names, love_story, category, mood, allowComments]
    );

    console.log(`✅ New story added by user ${userId}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creating story:", err.message);
    res.status(500).json({ error: "Failed to post story" });
  }
});

// ======================================================
// 3️⃣ LIKE/UNLIKE A STORY (Requires Auth - ROBUST TOGGLE)
// ======================================================
router.post("/:id/like", async (req, res) => {
  const client = await pool.connect(); 
  try {
    await client.query('BEGIN');
    
    const storyId = req.params.id;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "You must be logged in to like stories." });
    }

    const checkResult = await client.query(
      `SELECT * FROM likes WHERE user_id = $1 AND story_id = $2`,
      [userId, storyId]
    );

    let isLiked = checkResult.rowCount > 0;
    let newLikesCount;
    let action = '';

    if (isLiked) {
      await client.query(
        `DELETE FROM likes WHERE user_id = $1 AND story_id = $2`,
        [userId, storyId]
      );
      action = 'unliked';
    } else {
      await client.query(
        `INSERT INTO likes (user_id, story_id) VALUES ($1, $2)`,
        [userId, storyId]
      );
      action = 'liked';
    }

    // Recalculate and update the total likes_count on the stories table
    const countResult = await client.query(
      `UPDATE stories 
       SET likes_count = (SELECT COUNT(*) FROM likes WHERE story_id = $1),
           updated_at = NOW()
       WHERE id = $1
       RETURNING likes_count`,
      [storyId]
    );

    newLikesCount = countResult.rows[0].likes_count;
    await client.query('COMMIT');

    console.log(`❤️ Story ${storyId} ${action} by user ${userId}`);
    
    res.json({ 
        message: `Story ${action} successfully`, 
        likes_count: newLikesCount,
        is_liked: !isLiked 
    });

  } catch (err) {
    await client.query('ROLLBACK'); 
    console.error(`❌ Error toggling like for story ${storyId}:`, err.message);
    res.status(500).json({ error: "Failed to toggle like on story." });
  } finally {
    client.release();
  }
});

// ======================================================
// 4️⃣ ADD A COMMENT (Requires Auth)
// ======================================================
router.post("/:storyId/comments", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const storyId = req.params.storyId;
    const { text } = req.body;
    
    const userId = req.session?.user?.id; 

    if (!userId) {
      return res.status(401).json({ error: "Please log in to post a comment." });
    }
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Comment text cannot be empty." });
    }

    // A. Insert the comment
    const commentResult = await client.query(
      `INSERT INTO comments (story_id, user_id, comment_text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [storyId, userId, text.trim()]
    );
    
    // B. Increment the comments_count
    const updateResult = await client.query(
      `UPDATE stories 
       SET comments_count = COALESCE(comments_count, 0) + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING comments_count`,
      [storyId]
    );

    await client.query('COMMIT');

    const newCommentCount = updateResult.rows[0].comments_count;

    console.log(`💬 Comment added to story ${storyId} by user ${userId}`);
    
    res.status(201).json({ 
        message: "Comment posted successfully",
        comment: commentResult.rows[0],
        comments_count: newCommentCount 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Error posting comment to story ${req.params.storyId}:`, err.message);
    res.status(500).json({ error: "Failed to post comment." });
  } finally {
    client.release();
  }
});

// ======================================================
// 5️⃣ FETCH COMMENTS
// ======================================================
router.get("/:storyId/comments", async (req, res) => {
    try {
        const storyId = req.params.storyId;
        
        // Join with users table to get the author's username/name
        const result = await pool.query(
            `SELECT 
                c.id, 
                c.comment_text, 
                c.created_at, 
                COALESCE(u.username, 'Anonymous') as author_name,
                c.user_id
             FROM comments c
             JOIN users u ON c.user_id = u.id 
             WHERE c.story_id = $1
             ORDER BY c.created_at ASC`,
            [storyId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(`❌ Error fetching comments for story ${req.params.storyId}:`, err.message);
        res.status(500).json({ error: "Failed to fetch comments." });
    }
});

export default router;
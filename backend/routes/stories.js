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

    // backend/routes/stories.js (Replace the INSERT query)
  const result = await pool.query(
    `INSERT INTO stories 
        (user_id, story_title, couple_names, love_story, category, mood, allow_comments, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) // $7 added
     RETURNING *`,
    [
        userId, 
        story_title, 
        couple_names, 
        love_story, 
        category, 
        mood, 
        allowComments // ⬅️ ADDED
    ]
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
  const client = await pool.connect(); // Use a client for transactions
  try {
    await client.query('BEGIN');
    
    const storyId = req.params.id;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "You must be logged in to like stories." });
    }

    // 1. Check if the user has already liked this story
    const checkResult = await client.query(
      `SELECT * FROM likes WHERE user_id = $1 AND story_id = $2`,
      [userId, storyId]
    );

    let isLiked = checkResult.rowCount > 0;
    let newLikesCount;
    let action = '';

    if (isLiked) {
      // 2. If already liked, UNLIKE (DELETE from likes table)
      await client.query(
        `DELETE FROM likes WHERE user_id = $1 AND story_id = $2`,
        [userId, storyId]
      );
      action = 'unliked';
    } else {
      // 3. If not liked, LIKE (INSERT into likes table)
      await client.query(
        `INSERT INTO likes (user_id, story_id) VALUES ($1, $2)`,
        [userId, storyId]
      );
      action = 'liked';
    }

    // 4. Recalculate and update the total likes_count on the stories table
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
    
    // 5. Send the new status and count back to the frontend
    res.json({ 
        message: `Story ${action} successfully`, 
        likes_count: newLikesCount,
        // The new like status is the opposite of what it was before the action
        is_liked: !isLiked 
    });

  } catch (err) {
    await client.query('ROLLBACK'); // Important: roll back transaction on error
    console.error(`❌ Error toggling like for story ${storyId}:`, err.message);
    res.status(500).json({ error: "Failed to toggle like on story." });
  } finally {
    client.release();
  }
});

// backend/routes/stories.js (Add this new block)

// ======================================================
// 4️⃣ ADD A COMMENT (Requires Auth)
// ======================================================
router.post("/:storyId/comments", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const storyId = req.params.storyId;
    const { text } = req.body;
    
    // 🔑 CRITICAL: Get User ID from session (We assume comments require login based on frontend logic)
    const userId = req.session?.user?.id; 

    if (!userId) {
      // You can choose to allow anonymous, but for now, require login
      return res.status(401).json({ error: "Please log in to post a comment." });
    }
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Comment text cannot be empty." });
    }

    // A. Insert the comment into the comments table
    const commentResult = await client.query(
      `INSERT INTO comments (story_id, user_id, comment_text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [storyId, userId, text.trim()]
    );
    
    // B. Increment the comments_count on the stories table
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
    
    // C. Respond with the new count (or the comment itself)
    res.status(201).json({ 
        message: "Comment posted successfully",
        comment: commentResult.rows[0],
        comments_count: newCommentCount // Send the updated count for UI update
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Error posting comment to story ${req.params.storyId}:`, err.message);
    res.status(500).json({ error: "Failed to post comment." });
  } finally {
    client.release();
  }
});

// backend/routes/stories.js (Add this new block)

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
             JOIN users u ON c.user_id = u.id -- Simple join assuming all comments require user_id
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
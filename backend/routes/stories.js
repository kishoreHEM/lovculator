import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================================================
// Helper Middleware: Authentication Check
// ======================================================
const isAuthenticated = (req, res, next) => {
    // Check for a valid session user ID or user object
    if (req.session?.userId) { 
        // Attach the user ID to the request for easy access in the route
        req.user = { id: req.session.userId };
        return next();
    }
    // Handle cases where the session structure might be different
    if (req.session?.user?.id) {
         req.user = { id: req.session.user.id };
        return next();
    }
    
    // If not authenticated, send 401
    res.status(401).json({ error: 'Unauthorized: Please log in to perform this action.' });
};

// ======================================================
// 1️⃣ GET ALL STORIES (Now with Filtering and Search)
// ======================================================
router.get("/", async (req, res) => {
    // Extract optional query parameters
    const userId = req.query.userId;
    const category = req.query.category;
    const searchQuery = req.query.search;
    const sessionUserId = req.session?.userId;
    
    // SQL query building variables
    // NOTE: The shares table reference is now correctly working since you created it!
    let query = `
    SELECT
        s.id,
        s.user_id,
        s.couple_names,
        s.story_title,
        s.love_story,
        s.category,
        s.mood,
        s.together_since,
        s.anonymous_post,
        s.allow_comments,
        s.created_at,
        COALESCE(lc.likes_count, 0) AS likes_count,
        COALESCE(cc.comments_count, 0) AS comments_count,
        COALESCE(sh.shares_count, 0) AS shares_count,
        CASE WHEN EXISTS (
            SELECT 1 FROM likes l 
            WHERE l.story_id = s.id 
            AND (
                l.user_id = $1 OR 
                l.anon_id = $2
            )
        ) THEN TRUE ELSE FALSE END AS user_liked
    FROM
        stories s
    LEFT JOIN (SELECT story_id, COUNT(*) AS likes_count FROM likes GROUP BY story_id) lc ON s.id = lc.story_id
    LEFT JOIN (SELECT story_id, COUNT(*) AS comments_count FROM comments GROUP BY story_id) cc ON s.id = cc.story_id
    -- 🛑 FIXED LINE: Use public.shares to ensure the table is found
    LEFT JOIN (SELECT story_id, COUNT(*) AS shares_count FROM public.shares GROUP BY story_id) sh ON s.id = sh.story_id
`;

    const queryParams = [
        sessionUserId || null, // $1: user_id for user_liked check
        req.headers['x-anon-id'] || 'no_anon_id' // $2: anon_id for user_liked check
    ];
    
    const conditions = [];

    // 1. Filter by specific user ID (for profile page)
    if (userId) {
        conditions.push(`s.user_id = $${queryParams.length + 1}`);
        queryParams.push(userId);
    }
    
    // 2. Filter by Category
    if (category && category !== 'all') {
        conditions.push(`s.category = $${queryParams.length + 1}`);
        queryParams.push(category);
    }

    // 3. Filter by Search Query (title or story content)
    if (searchQuery) {
        // Use ILIKE for case-insensitive pattern matching
        conditions.push(`(s.story_title ILIKE $${queryParams.length + 1} OR s.love_story ILIKE $${queryParams.length + 2})`);
        queryParams.push(`%${searchQuery}%`); // For story_title
        queryParams.push(`%${searchQuery}%`); // For love_story (reuses the value, but needs a new placeholder)
    }

    // Append WHERE clause if conditions exist
    if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
    }

    // Final ordering
    query += ` ORDER BY s.created_at DESC;`;

    try {
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching stories with filters:", err);
        res.status(500).json({ error: "Failed to fetch stories." });
    }
});

// ======================================================
// 2️⃣ CREATE NEW STORY (Requires Auth)
// ======================================================
router.post("/", isAuthenticated, async (req, res) => { // Added isAuthenticated
  try {
    // 🔑 FIX: Ensure 'allowComments' is destructured
    const { 
        story_title, 
        couple_names, 
        love_story, 
        category, 
        mood, 
        allowComments,
        anonymousPost
    } = req.body;
    
    const userId = req.user.id; // Get user ID from middleware

    if (!story_title || !love_story) {
      return res.status(400).json({ error: "Story title and content are required." });
    }
    
    const names = anonymousPost ? 'Anonymous Couple' : couple_names;
    const anonStatus = anonymousPost || false;

    // 🔑 FIX: Correctly insert all fields, including allow_comments and anonymous_post
    const result = await pool.query(
      `INSERT INTO stories 
        (user_id, story_title, couple_names, love_story, category, mood, allow_comments, anonymous_post, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [userId, story_title, names, love_story, category, mood, allowComments, anonStatus]
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
router.post("/:id/like", isAuthenticated, async (req, res) => { // Added isAuthenticated
  const client = await pool.connect(); 
  try {
    await client.query('BEGIN');
    
    const storyId = req.params.id;
    const userId = req.user.id; // Get user ID from middleware

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
    // NOTE: This assumes you have a 'likes_count' column on the 'stories' table.
    // If not, you may need to adjust your schema to track aggregate counts.
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
router.post("/:storyId/comments", isAuthenticated, async (req, res) => { // Added isAuthenticated
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const storyId = req.params.storyId;
    const { text } = req.body;
    
    const userId = req.user.id; // Get user ID from middleware

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
    // NOTE: This assumes you have a 'comments_count' column on the 'stories' table.
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

// ======================================================
// 6️⃣ DELETE A STORY (Requires Auth & Authorization)
// ======================================================
router.delete('/:storyId', isAuthenticated, async (req, res) => {
    const { storyId } = req.params;
    const userId = req.user.id; // User ID attached by the isAuthenticated middleware

    if (!storyId || isNaN(storyId)) {
        return res.status(400).json({ error: 'Invalid story ID.' });
    }

    try {
        // Step 1: Check ownership/authorization
        const storyCheck = await pool.query(
            `SELECT user_id FROM stories WHERE id = $1`, 
            [storyId]
        );

        if (storyCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Story not found.' });
        }

        const storyOwnerId = storyCheck.rows[0].user_id;

        // Authorization Check: Only the owner can delete the story.
        const isAuthorized = (storyOwnerId === userId); 

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Forbidden: You can only delete your own stories.' });
        }
        
        // Step 2: Delete the story
        await pool.query(
            `DELETE FROM stories WHERE id = $1`,
            [storyId]
        );

        console.log(`💀 Story ${storyId} deleted by user ${userId}`);
        res.status(204).send(); // 204 No Content for a successful deletion

    } catch (error) {
        console.error(`❌ Error deleting story ${storyId}:`, error);
        res.status(500).json({ error: 'Internal server error while deleting story.' });
    }
});


export default router;
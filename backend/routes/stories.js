import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================================================
// Helper Middleware: Authentication Check
// ======================================================
const isAuthenticated = (req, res, next) => {
    const userId = req.session?.userId || req.session?.user?.id;
    if (userId) {
        req.user = { id: userId };
        return next();
    }
    res.status(401).json({ error: "Unauthorized: Please log in to perform this action." });
};

// ======================================================
// 1️⃣ GET ALL STORIES (FINAL FIXED SQL)
// ======================================================
router.get("/", async (req, res) => {
    const userId = req.query.userId;
    const category = req.query.category;
    const searchQuery = req.query.search;
    const sessionUserId = req.session?.userId;

    const queryParams = [
        sessionUserId || 0 // $1: user_id for logged in user
    ];

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
            COALESCE(sc.shares_count, 0) AS shares_count,
            CASE WHEN EXISTS (
                SELECT 1 FROM story_likes l
                WHERE l.story_id = s.id 
                AND l.user_id = $1
            ) THEN TRUE ELSE FALSE END AS user_liked
        FROM
            stories s
        LEFT JOIN (SELECT story_id, COUNT(*) AS likes_count FROM story_likes GROUP BY story_id) lc ON s.id = lc.story_id
        LEFT JOIN (SELECT story_id, COUNT(*) AS comments_count FROM story_comments GROUP BY story_id) cc ON s.id = cc.story_id
        LEFT JOIN (SELECT story_id, COUNT(*) AS shares_count FROM shares GROUP BY story_id) sc ON s.id = sc.story_id
    `;

    const conditions = [];

    if (userId) {
        conditions.push(`s.user_id = $${queryParams.length + 1}`);
        queryParams.push(userId);
    }

    if (category && category !== "all") {
        conditions.push(`s.category = $${queryParams.length + 1}`);
        queryParams.push(category);
    }

    if (searchQuery) {
        conditions.push(`(s.story_title ILIKE $${queryParams.length + 1} OR s.love_story ILIKE $${queryParams.length + 2})`);
        queryParams.push(`%${searchQuery}%`);
        queryParams.push(`%${searchQuery}%`);
    }

    if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY s.created_at DESC;`;

    try {
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching stories with filters (500 crash point):", err);
        res.status(500).json({ error: "Failed to fetch stories." });
    }
});

// ======================================================
// 2️⃣ CREATE NEW STORY (Requires Auth)
// ======================================================
router.post("/", isAuthenticated, async (req, res) => {
    try {
        const {
            story_title,
            couple_names,
            love_story,
            category,
            mood,
            allowComments,
            anonymousPost,
            togetherSince
        } = req.body;

        const userId = req.user.id;
        if (!story_title || !love_story) {
            return res.status(400).json({ error: "Story title and content are required." });
        }

        const names = anonymousPost ? "Anonymous Couple" : couple_names;

        const result = await pool.query(
            `INSERT INTO stories 
             (user_id, story_title, couple_names, love_story, category, mood, together_since, allow_comments, anonymous_post, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
             RETURNING *`,
            [userId, story_title, names, love_story, category, mood, togetherSince, allowComments, anonymousPost]
        );

        console.log(`✅ New story added by user ${userId}`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("❌ Error creating story:", err.message);
        res.status(500).json({ error: "Failed to post story" });
    }
});

// ======================================================
// 3️⃣ LIKE / UNLIKE A STORY (Requires Auth)
// ======================================================
router.post("/:id/like", isAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const storyId = parseInt(req.params.id, 10);
        const userId = req.user.id;

        const existing = await client.query(
            `SELECT 1 FROM story_likes WHERE user_id = $1 AND story_id = $2 FOR UPDATE`,
            [userId, storyId]
        );

        let action = "";
        if (existing.rowCount > 0) {
            await client.query(
                `DELETE FROM story_likes WHERE user_id = $1 AND story_id = $2`,
                [userId, storyId]
            );
            action = "unliked";
        } else {
            await client.query(
                `INSERT INTO story_likes (user_id, story_id)
                 VALUES ($1, $2)
                 ON CONFLICT (story_id, user_id) DO NOTHING`,
                [userId, storyId]
            );
            action = "liked";
        }

        const countResult = await client.query(
            `SELECT COUNT(*) AS likes_count FROM story_likes WHERE story_id = $1`,
            [storyId]
        );

        await client.query("COMMIT");

        console.log(`❤️ Story ${storyId} ${action} by user ${userId}`);

        res.json({
            message: `Story ${action} successfully.`,
            likes_count: parseInt(countResult.rows[0].likes_count, 10),
            is_liked: action === "liked"
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ Error toggling like for story ${req.params.id}:`, err.message);
        res.status(500).json({ error: "Failed to toggle like on story." });
    } finally {
        client.release();
    }
});

// ======================================================
// 4️⃣ ADD A COMMENT (Requires Auth)
// ======================================================
router.post("/:storyId/comments", isAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const storyId = parseInt(req.params.storyId, 10);
        const { text } = req.body;
        const userId = req.user.id;

        if (!text || text.trim().length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Comment text cannot be empty." });
        }

        // ✅ Ensure story exists before inserting
        const storyExists = await client.query(
            `SELECT id FROM stories WHERE id = $1`,
            [storyId]
        );
        if (storyExists.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Story not found." });
        }

        // ✅ Insert comment
        const commentResult = await client.query(
            `INSERT INTO story_comments (story_id, user_id, comment_text, created_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING id, story_id, user_id, comment_text, created_at`,
            [storyId, userId, text.trim()]
        );

        // ✅ Update count on story
        const updateResult = await client.query(
            `UPDATE stories
             SET comments_count = COALESCE(comments_count, 0) + 1,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING comments_count`,
            [storyId]
        );

        await client.query("COMMIT");

        console.log(`💬 Comment added to story ${storyId} by user ${userId}`);

        res.status(201).json({
            message: "Comment posted successfully.",
            comment: commentResult.rows[0],
            comments_count: updateResult.rows[0].comments_count
        });
    } catch (err) {
        await client.query("ROLLBACK");
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

        const result = await pool.query(
            `SELECT 
                c.id, 
                c.comment_text, 
                c.created_at, 
                COALESCE(u.username, 'Anonymous') as author_name,
                c.user_id
             FROM story_comments c
             LEFT JOIN users u ON c.user_id = u.id 
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
// 6️⃣ SHARE A STORY
// ======================================================
router.post("/:storyId/share", async (req, res) => {
    try {
        const storyId = req.params.storyId;
        const anonId = req.headers["x-anon-id"];
        const userId = req.session?.userId || null;

        await pool.query(
            `INSERT INTO shares (story_id, user_id, anon_id)
             VALUES ($1, $2, $3)`,
            [storyId, userId, anonId]
        );

        const result = await pool.query(
            `SELECT COUNT(*) AS shares_count FROM shares WHERE story_id = $1`,
            [storyId]
        );

        res.json({
            message: "Share tracked successfully.",
            shares_count: parseInt(result.rows[0].shares_count, 10)
        });
    } catch (err) {
        console.error("❌ Error tracking share:", err.message);
        res.status(500).json({ error: "Failed to track share." });
    }
});

// ======================================================
// 7️⃣ DELETE A STORY (Requires Auth)
// ======================================================
router.delete("/:storyId", isAuthenticated, async (req, res) => {
    const { storyId } = req.params;
    const userId = req.user.id;

    try {
        const storyCheck = await pool.query(`SELECT user_id FROM stories WHERE id = $1`, [storyId]);
        if (storyCheck.rowCount === 0)
            return res.status(404).json({ error: "Story not found." });

        if (storyCheck.rows[0].user_id !== userId)
            return res.status(403).json({ error: "Forbidden: You can only delete your own story." });

        await pool.query(`DELETE FROM stories WHERE id = $1`, [storyId]);

        console.log(`💀 Story ${storyId} deleted by user ${userId}`);
        res.status(204).send();
    } catch (err) {
        console.error(`❌ Error deleting story ${storyId}:`, err.message);
        res.status(500).json({ error: "Failed to delete story." });
    }
});

// ======================================================
// 8️⃣ REPORT A STORY (Requires Auth)
// ======================================================
router.post("/:storyId/report", isAuthenticated, async (req, res) => {
    const { storyId } = req.params;
    const { reason, description } = req.body;
    const reporterId = req.user.id;

    if (!storyId || isNaN(storyId) || !reason) {
        return res.status(400).json({ error: "Invalid story ID or missing report reason." });
    }

    try {
        const storyCheck = await pool.query(`SELECT id FROM stories WHERE id = $1`, [storyId]);
        if (storyCheck.rowCount === 0) {
            return res.status(404).json({ error: "Story not found." });
        }

        await pool.query(
            `INSERT INTO story_reports (story_id, reporter_id, reason, description)
             VALUES ($1, $2, $3, $4)`,
            [storyId, reporterId, reason, description || null]
        );

        console.log(`⚠️ Story ${storyId} reported by user ${reporterId}. Reason: ${reason}`);
        res.status(201).json({ message: "Story reported successfully. We will review it shortly." });
    } catch (err) {
        console.error(`❌ Error reporting story ${storyId}:`, err.message);
        res.status(500).json({ error: "Failed to submit report." });
    }
});

export default router;

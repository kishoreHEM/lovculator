// backend/routes/feed.js

import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   GET /api/posts/feed
====================================================== */
router.get("/", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const { rows } = await pool.query(
            `
            SELECT 
                p.id,
                p.content,
                p.image_url,
                p.feeling,
                p.privacy,
                p.created_at,

                -- POST OWNER DETAILS
                u.id AS user_id,
                u.username,
                u.display_name,
                COALESCE(NULLIF(NULLIF(u.avatar_url, ''), 'null'), '/images/default-avatar.png') AS avatar_url,

                -- ❤️ LIKE COUNT
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS like_count,

                -- 💬 COMMENT COUNT
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,

                -- 👆 CURRENT USER LIKED?
                EXISTS (
                    SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1
                ) AS is_liked,

                -- 🤝 IS OWNER?
                p.user_id = $1 AS is_owner,

                -- 🟣 FOLLOW STATUS
                EXISTS (
                    SELECT 1 FROM follows 
                    WHERE follower_id = $1 AND target_id = p.user_id
                ) AS is_following

            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.privacy = 'public'
            ORDER BY p.created_at DESC
            LIMIT 50
            `,
            [userId]
        );

        res.json({ success: true, posts: rows });

    } catch (error) {
        console.error("❌ Feed Load Error:", error);
        res.status(500).json({ error: "Failed to load feed" });
    }
});

export default router;

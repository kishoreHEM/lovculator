import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// GET comments for a post
router.get("/:postId/comments", auth, async (req, res) => {
    try {
        const postId = req.params.postId;

        const { rows } = await pool.query(
            `
            SELECT 
                c.id,
                c.content AS comment,
                c.created_at,
                u.id AS user_id,
                u.username,
                u.display_name,
                u.avatar_url
            FROM post_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC
            `,
            [postId]
        );

        res.json({ success: true, comments: rows });

    } catch (error) {
        console.error("❌ Load Comments Error:", error);
        res.status(500).json({ error: "Failed to load comments" });
    }
});



export default router;

// backend/routes/posts.js

import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { notifyLike, notifyComment } from "./notifications.js";

const router = express.Router();

//
// 📂 FILE STORAGE SETUP
//
const uploadDir = "uploads/posts";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({ storage });

/* ======================================================
   📝 CREATE POST
====================================================== */
router.post("/", auth, upload.single("image"), async (req, res) => {
    try {
        const userId = req.user.id;
        const { content, privacy, feeling } = req.body;

        const imageUrl = req.file ? `/uploads/posts/${req.file.filename}` : null;

        if (!content && !imageUrl) {
            return res.status(400).json({ error: "Post cannot be empty" });
        }

        const result = await pool.query(
            `INSERT INTO posts (user_id, content, image_url, feeling, privacy)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, content || null, imageUrl, feeling || null, privacy]
        );

        res.json({
            success: true,
            post: result.rows[0],
            message: "Post created successfully!"
        });

    } catch (error) {
        console.error("❌ Create Post Error:", error);
        res.status(500).json({ error: "Failed to create post" });
    }
});

/* ======================================================
   ❤️ LIKE / UNLIKE POST + NOTIFY + REALTIME
====================================================== */
router.post("/:postId/like", auth, async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.user.id;

        // Check existing like
        const check = await pool.query(
            `SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
        );

        if (check.rows.length > 0) {
            // 🔁 Unlike
            await pool.query(
                `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
                [postId, userId]
            );
        } else {
            // ❤️ Like
            await pool.query(
                `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`,
                [postId, userId]
            );
        }

        // Updated count
        const { rows } = await pool.query(
            `SELECT COUNT(*) AS like_count FROM post_likes WHERE post_id = $1`,
            [postId]
        );

        const like_count = Number(rows[0].like_count);

        // Find post owner
        const ownerResult = await pool.query(
            `SELECT user_id FROM posts WHERE id = $1`,
            [postId]
        );
        const postOwnerId = ownerResult.rows[0]?.user_id;

        // Prevent notifying yourself
        if (postOwnerId && postOwnerId !== userId && check.rows.length === 0) {
            await notifyLike(postOwnerId, userId, "post", postId);
            const broadcastNotify = req.app.get("broadcastNotification");
            if (broadcastNotify) {
                broadcastNotify({ type: "NEW_NOTIFICATION" }, [postOwnerId]);
            }
        }

        // 🔥 realtime broadcast LIKE count
        const broadcast = req.app.get("broadcastLike");
        if (broadcast) {
            broadcast({ type: "LIKE_UPDATED", postId, like_count });
        }

        res.json({ success: true, like_count });

    } catch (error) {
        console.error("❌ Like Error:", error);
        res.status(500).json({ error: "Failed to like/unlike post" });
    }
});

/* ======================================================
   💬 ADD COMMENT + REALTIME + NOTIFICATION
====================================================== */
router.post("/:postId/comments", auth, async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.user.id;
        const { content } = req.body;

        if (!content || content.trim() === "") {
            return res.status(400).json({ error: "Comment cannot be empty" });
        }

        await pool.query(
            `INSERT INTO post_comments (post_id, user_id, content)
             VALUES ($1, $2, $3)`,
            [postId, userId, content.trim()]
        );

        const countResult = await pool.query(
            `SELECT COUNT(*) AS commentCount FROM post_comments WHERE post_id = $1`,
            [postId]
        );

        const commentCount = Number(countResult.rows[0].commentCount);

        // Find post owner
        const ownerResult = await pool.query(
            `SELECT user_id FROM posts WHERE id = $1`,
            [postId]
        );
        const postOwnerId = ownerResult.rows[0]?.user_id;

        if (postOwnerId && postOwnerId !== userId) {
            await notifyComment(postOwnerId, userId, "post", postId);

            const broadcastNotify = req.app.get("broadcastNotification");
            if (broadcastNotify) {
                broadcastNotify({ type: "NEW_NOTIFICATION" }, [postOwnerId]);
            }
        }

        // Broadcast realtime
        const broadcast = req.app.get("broadcastComment");
        if (broadcast) {
            broadcast({
                type: "COMMENT_ADDED",
                postId,
                commentCount
            });
        }

        res.json({ success: true });

    } catch (error) {
        console.error("❌ Add Comment Error:", error);
        res.status(500).json({ error: "Failed to add comment" });
    }
});

/* ======================================================
   📘 GET COMMENTS FOR POST
====================================================== */
router.get("/:postId/comments", auth, async (req, res) => {
    try {
        const postId = req.params.postId;

        const { rows } = await pool.query(
            `SELECT 
                c.id,
                c.content,
                c.created_at,
                u.id AS user_id,
                u.username,
                u.display_name,
                u.avatar_url
              FROM post_comments c
              JOIN users u ON u.id = c.user_id
              WHERE c.post_id = $1
              ORDER BY c.created_at ASC`,
            [postId]
        );

        res.json({ success: true, comments: rows });

    } catch (error) {
        console.error("❌ Load Comments Error:", error);
        res.status(500).json({ error: "Failed to load comments" });
    }
});

export default router;

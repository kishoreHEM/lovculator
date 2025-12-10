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
   ❤️ LIKE / UNLIKE POST + NOTIFY + REALTIME BROADCAST
====================================================== */
router.post("/:postId/like", auth, async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.user.id;

        // Check if already liked
        const check = await pool.query(
            `SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
        );

        let is_liked = false;

        if (check.rows.length > 0) {
            // UNLIKE
            await pool.query(
                `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
                [postId, userId]
            );
        } else {
            // LIKE
            await pool.query(
                `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`,
                [postId, userId]
            );
            is_liked = true;
        }

        // Current LIKE count
        const { rows } = await pool.query(
            `SELECT COUNT(*) AS like_count FROM post_likes WHERE post_id = $1`,
            [postId]
        );
        const like_count = Number(rows[0].like_count);

        // Post owner details
        const ownerResult = await pool.query(
            `SELECT user_id FROM posts WHERE id = $1`,
            [postId]
        );
        const postOwnerId = ownerResult.rows[0]?.user_id;

        // Notify only when liking, not unliking – and not your own post
        if (postOwnerId && postOwnerId !== userId && is_liked) {
            await notifyLike(req, post.user_id, req.user.id, "post", postId);
        }

        // 🔥 Real-time LIKE broadcast
        const broadcast = req.app.get("broadcastLike");
        if (broadcast) {
            broadcast({ type: "LIKE_UPDATED", postId, like_count, is_liked });
        }

        res.json({ success: true, like_count, is_liked });

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
        const actorId = req.user.id;   // 👈 correct name
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Comment cannot be empty" });
        }

        // 1️⃣ Insert comment
        await pool.query(
            `INSERT INTO post_comments (post_id, user_id, content)
             VALUES ($1, $2, $3)`,
            [postId, actorId, content.trim()]
        );

        // 2️⃣ Update comment count
        const countResult = await pool.query(
            `SELECT COUNT(*) AS commentCount FROM post_comments WHERE post_id = $1`,
            [postId]
        );
        const commentCount = Number(countResult.rows[0].commentCount);

        // 3️⃣ Get post owner
        const ownerResult = await pool.query(
            `SELECT user_id FROM posts WHERE id = $1`,
            [postId]
        );

        const postOwnerId = ownerResult.rows[0]?.user_id;

        // 4️⃣ Notify post owner (ONLY if someone else commented)
        if (postOwnerId && postOwnerId !== actorId) {
            await notifyComment(req, postOwnerId, actorId, "post", postId);
        }

        // 5️⃣ Broadcast comment count update
        const broadcastComment = req.app.get("broadcastComment");
        if (broadcastComment) {
            broadcastComment({
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
   📘 GET COMMENTS ONLY
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

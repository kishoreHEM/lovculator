// backend/routes/notifications.js

import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   📨 1️⃣ Get notifications (pagination + filters) - FIXED
====================================================== */
router.get("/", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { filter = "all", page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let baseQuery = `
            SELECT 
                n.id,
                n.type,
                n.message,
                n.link,
                n.is_read,
                n.created_at,
                u.username AS actor_username,
                u.display_name AS actor_display_name,
                u.avatar_url AS actor_avatar_url
            FROM notifications n
            LEFT JOIN users u ON n.actor_id = u.id
            WHERE n.user_id = $1
        `;

        let countQuery = `SELECT COUNT(*) FROM notifications WHERE user_id = $1`;
        let params = [userId];

        if (filter === "unread") {
            baseQuery += ` AND n.is_read = false`;
            countQuery += ` AND is_read = false`;
        } else if (filter !== "all") {
            params.push(filter);
            baseQuery += ` AND n.type = $${params.length}`;
            countQuery += ` AND type = $${params.length}`;
        }

        params.push(Number(limit), Number(offset));
        baseQuery += ` ORDER BY n.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const [notificationsResult, countResult] = await Promise.all([
            pool.query(baseQuery, params),
            pool.query(countQuery, params.slice(0, params.length - 2))
        ]);

        res.json({
            success: true,
            notifications: notificationsResult.rows,
            pagination: {
                page: Number(page),
                total: Number(countResult.rows[0].count),
                totalPages: Math.ceil(Number(countResult.rows[0].count) / limit),
                hasMore: Number(page) < Math.ceil(Number(countResult.rows[0].count) / limit)
            }
        });

    } catch (error) {
        console.error("❌ Get notifications error:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

/* ======================================================
   👁 2️⃣ Mark as read
====================================================== */
router.post("/:id/read", auth, async (req, res) => {
    try {
        await pool.query(
            "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
            [req.params.id, req.user.id]
        );
        res.json({ success: true });

    } catch (error) {
        console.error("❌ Mark read error:", error);
        res.status(500).json({ error: "Failed to mark read" });
    }
});

/* ======================================================
   🗑 3️⃣ Clear all
====================================================== */
router.delete("/clear-all", auth, async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM notifications WHERE user_id = $1",
            [req.user.id]
        );

        res.json({
            success: true,
            message: `Cleared ${result.rowCount} notifications`
        });

    } catch (error) {
        console.error("❌ Clear all error:", error);
        res.status(500).json({ error: "Failed to clear notifications" });
    }
});

/* ======================================================
   🔢 4️⃣ Unread count
====================================================== */
router.get("/unread-count", auth, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false",
            [req.user.id]
        );

        res.json({
            success: true,
            count: Number(result.rows[0].count)
        });

    } catch (error) {
        console.error("❌ Unread count error:", error);
        res.status(500).json({ error: "Failed to get unread count" });
    }
});

/* ======================================================
   🎯 Helper: Create notification
====================================================== */
export const createNotification = async ({
    userId,
    actorId,
    type,
    message,
    link = null
}) => {
    const result = await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, message, link, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, false, NOW())
         RETURNING *`,
        [userId, actorId, type, message, link]
    );

    return result.rows[0];
};

/* ======================================================
   🔔 Notify functions (FIXED - removed req parameter)
====================================================== */
export const notifyLike = async (targetUserId, actorId, postType, postId) => {
    try {
        // Don't notify if user is liking their own content
        if (targetUserId === actorId) {
            console.log("Skipping notification: user liking own content");
            return;
        }

        const actor = await pool.query("SELECT display_name, username FROM users WHERE id = $1", [actorId]);
        if (!actor.rows.length) return;

        const name = actor.rows[0].display_name || actor.rows[0].username;

        const notification = await createNotification({
            userId: targetUserId,
            actorId,
            type: "like",
            message: `${name} liked your ${postType}`,
            link: `/post.html?id=${postId}`
        });

        console.log(`✅ Like notification created: ${notification.message}`);
        return notification;

    } catch (error) {
        console.error("❌ notifyLike error:", error);
        // Don't throw, just log the error so it doesn't break the main flow
        return null;
    }
};

export const notifyComment = async (targetUserId, actorId, postType, postId) => {
    try {
        // Don't notify if user is commenting on their own content
        if (targetUserId === actorId) {
            console.log("Skipping notification: user commenting on own content");
            return;
        }

        const actor = await pool.query("SELECT display_name, username FROM users WHERE id = $1", [actorId]);
        if (!actor.rows.length) return;

        const name = actor.rows[0].display_name || actor.rows[0].username;

        const notification = await createNotification({
            userId: targetUserId,
            actorId,
            type: "comment",
            message: `${name} commented on your ${postType}`,
            link: `/post.html?id=${postId}`
        });

        console.log(`✅ Comment notification created: ${notification.message}`);
        return notification;

    } catch (error) {
        console.error("❌ notifyComment error:", error);
        // Don't throw, just log the error so it doesn't break the main flow
        return null;
    }
};

export const notifyFollow = async (targetUserId, actorId) => {
    try {
        // Don't notify if user is following themselves
        if (targetUserId === actorId) {
            console.log("Skipping notification: user following themselves");
            return;
        }

        const actor = await pool.query("SELECT display_name, username FROM users WHERE id = $1", [actorId]);
        if (!actor.rows.length) return;

        const name = actor.rows[0].display_name || actor.rows[0].username;

        const notification = await createNotification({
            userId: targetUserId,
            actorId,
            type: "follow",
            message: `${name} started following you`,
            link: `/profile.html?user=${actorId}`
        });

        console.log(`✅ Follow notification created: ${notification.message}`);
        return notification;

    } catch (error) {
        console.error("❌ notifyFollow error:", error);
        return null;
    }
};

// Keep notifyMessage as is if it's working
export const notifyMessage = async (targetUserId, actorId) => {
    // ... existing code
};

export default router;

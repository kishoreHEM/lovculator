import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   📨 1️⃣ Get notifications (pagination + filters)
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
   👁 2️⃣ Mark single notification as read
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
   ✅ 3️⃣ Mark ALL notifications as read
====================================================== */
router.post("/mark-all-read", auth, async (req, res) => {
    try {
        await pool.query(
            "UPDATE notifications SET is_read = true WHERE user_id = $1",
            [req.user.id]
        );
        res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        console.error("❌ Mark all read error:", error);
        res.status(500).json({ error: "Failed to mark all as read" });
    }
});

/* ======================================================
   🗑 4️⃣ Clear all notifications
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
   🔢 5️⃣ Unread count
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
   🎯 HELPER: Create notification & Broadcast Real-Time
   ⚠️ IMPORTANT: Caller must pass 'req' object!
====================================================== */
export const createNotification = async (req, {
    userId,
    actorId,
    type,
    message,
    link = null
}) => {
    try {
        // 1. Save to Database
        const result = await pool.query(
            `INSERT INTO notifications (user_id, actor_id, type, message, link, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, false, NOW())
             RETURNING *,
             (SELECT username FROM users WHERE id = $2) as actor_username,
             (SELECT display_name FROM users WHERE id = $2) as actor_display_name,
             (SELECT avatar_url FROM users WHERE id = $2) as actor_avatar_url`,
            [userId, actorId, type, message, link]
        );

        const notification = result.rows[0];

        // 2. Broadcast via WebSocket (The Real-Time Magic 🌟)
        if (req && req.app) {
            const broadcast = req.app.get("broadcastNotification");
            if (broadcast) {
                console.log(`📡 Broadcasting notification to user ${userId}`);
                broadcast(userId, {
                    type: "NEW_NOTIFICATION",
                    notification: notification
                });
            } else {
                console.log("⚠️ Broadcast function not found on app");
            }
        }

        return notification;
    } catch (error) {
        console.error("❌ createNotification error:", error);
        return null;
    }
};

/* ======================================================
   🔔 EXPORTED NOTIFY FUNCTIONS
   ⚠️ Remember to update your route files (posts.js, etc.)
   to pass 'req' as the first argument!
====================================================== */

export const notifyLike = async (req, targetUserId, actorId, postType, postId) => {
    // Don't notify if user is liking their own content
    if (parseInt(targetUserId) === parseInt(actorId)) return;

    try {
        const actor = await pool.query("SELECT display_name, username FROM users WHERE id = $1", [actorId]);
        if (!actor.rows.length) return;

        const name = actor.rows[0].display_name || actor.rows[0].username;

        return await createNotification(req, {
            userId: targetUserId,
            actorId,
            type: "like",
            message: `${name} liked your ${postType}`,
            link: `/post.html?id=${postId}`
        });
    } catch (err) {
        console.error("notifyLike failed:", err);
    }
};

export const notifyComment = async (req, targetUserId, actorId, postType, postId) => {
    // Don't notify if user is commenting on their own content
    if (parseInt(targetUserId) === parseInt(actorId)) return;

    try {
        const actor = await pool.query("SELECT display_name, username FROM users WHERE id = $1", [actorId]);
        if (!actor.rows.length) return;

        const name = actor.rows[0].display_name || actor.rows[0].username;

        return await createNotification(req, {
            userId: targetUserId,
            actorId,
            type: "comment",
            message: `${name} commented on your ${postType}`,
            link: `/post.html?id=${postId}`
        });
    } catch (err) {
        console.error("notifyComment failed:", err);
    }
};

export const notifyFollow = async (req, targetUserId, actorId) => {
    // Don't notify if user is following themselves
    if (parseInt(targetUserId) === parseInt(actorId)) return;

    try {
        const actor = await pool.query("SELECT display_name, username FROM users WHERE id = $1", [actorId]);
        if (!actor.rows.length) return;

        const name = actor.rows[0].display_name || actor.rows[0].username;

        return await createNotification(req, {
            userId: targetUserId,
            actorId,
            type: "follow",
            message: `${name} started following you`,
            link: `/profile.html?user=${actorId}`
        });
    } catch (err) {
        console.error("notifyFollow failed:", err);
    }
};

export default router;
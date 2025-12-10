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
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const filter = req.query.filter || "all";
        const offset = (page - 1) * limit;

        let whereClause = "WHERE n.user_id = $1";
        let queryParams = [userId];

        if (filter === "unread") {
            whereClause += " AND n.is_read = false";
        } else if (filter !== "all") {
            whereClause += ` AND n.type = $2`;
            queryParams.push(filter);
        }

        const notificationQuery = `
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
            ${whereClause}
            ORDER BY n.created_at DESC
            LIMIT $${queryParams.length + 1}
            OFFSET $${queryParams.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*) 
            FROM notifications n 
            LEFT JOIN users u ON n.actor_id = u.id
            ${whereClause}
        `;

        const paramsWithLimit = [...queryParams, limit, offset];

        const [notificationsResult, countResult] = await Promise.all([
            pool.query(notificationQuery, paramsWithLimit),
            pool.query(countQuery, queryParams)
        ]);

        const total = Number(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            notifications: notificationsResult.rows,
            pagination: {
                page,
                total,
                totalPages,
                hasMore: page < totalPages
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
====================================================== */
export const createNotification = async (req, {
    userId,
    actorId,
    type,
    message,
    link = null
}) => {
    try {
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

        // WebSocket Broadcast
        const broadcast = req?.app?.get("broadcastNotification");
        if (broadcast) {
            broadcast(userId, {
                type: "NEW_NOTIFICATION",
                notification
            });
        } else {
            console.log("⚠️ Notification broadcast handler missing");
        }

        return notification;
    } catch (error) {
        console.error("❌ createNotification error:", error);
        return null;
    }
};

/* ======================================================
   🔔 EXPORT NOTIFY SHORTCUTS
====================================================== */
export const notifyLike = async (req, targetUserId, actorId, postType, postId) => {
    if (parseInt(targetUserId) === parseInt(actorId)) return;
    try {
        const name = await fetchActorName(actorId);
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
    if (parseInt(targetUserId) === parseInt(actorId)) return;
    try {
        const name = await fetchActorName(actorId);
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
    if (parseInt(targetUserId) === parseInt(actorId)) return;
    try {
        const name = await fetchActorName(actorId);
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

/* ======================================================
   📌 Helper to get display_name or username
====================================================== */
async function fetchActorName(actorId) {
    const result = await pool.query(
        "SELECT display_name, username FROM users WHERE id = $1",
        [actorId]
    );
    const user = result.rows[0];
    return user?.display_name || user?.username || "Someone";
}

export default router;

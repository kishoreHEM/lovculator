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

        // 1. Initial query and parameters setup
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
        let queryParams = [userId];
        
        // 2. Add filter conditions dynamically
        if (filter === "unread") {
            baseQuery += ` AND n.is_read = false`;
            countQuery += ` AND is_read = false`;
        } else if (filter !== "all") {
            // Add the filter condition. 
            // The filter string itself becomes the next parameter ($2)
            queryParams.push(filter);
            baseQuery += ` AND n.type = $${queryParams.length}`; 
            countQuery += ` AND type = $${queryParams.length}`;
        }
        
        // 3. Add LIMIT and OFFSET parameters
        queryParams.push(Number(limit));
        queryParams.push(Number(offset));
        
        baseQuery += ` ORDER BY n.created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

        // 4. Run queries
        const [notificationsResult, countResult] = await Promise.all([
            // Pass the first part of the array (up to the limit/offset) for notifications
            pool.query(baseQuery, queryParams),
            // Pass only the first parameter (userId) and the type filter (if present) for the count
            pool.query(countQuery, queryParams.slice(0, queryParams.length - 2)) 
        ]);

        const notifications = notificationsResult.rows;
        const totalCount = Number(countResult.rows[0].count);

        res.json({
            success: true,
            notifications,
            pagination: {
                page: Number(page),
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasMore: Number(page) < Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error("❌ Get notifications error:", error);
        // Log the filter values for debugging
        console.error("DEBUG: Filter/Page/Limit:", req.query); 
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

/* ======================================================
   👁 2️⃣ Mark notification as read
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
   🗑 3️⃣ Clear all notifications
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
   🎯 5️⃣ Create notification helper
====================================================== */
export const createNotification = async ({
    userId,
    type,
    message,
    link = null,
    actorId = null
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
   🔔 6️⃣ Notify functions with WS broadcast
====================================================== */
export const notifyLike = async (targetUserId, actorId, postType, postId, req) => {
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

    const broadcast = req.app.get("broadcastNotification");
    if (broadcast) broadcast([targetUserId], { message: notification.message });

    return notification;
};

export const notifyComment = async (targetUserId, actorId, postType, postId, req) => {
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

    const broadcast = req.app.get("broadcastNotification");
    if (broadcast) broadcast([targetUserId], { message: notification.message });

    return notification;
};

export const notifyFollow = async (targetUserId, actorId, req) => {
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

    const broadcast = req.app.get("broadcastNotification");
    if (broadcast) broadcast([targetUserId], { message: notification.message });

    return notification;
};

export const notifyMessage = async (req, targetUserId, actorId) => {
  const actor = await pool.query(
    "SELECT display_name, username FROM users WHERE id = $1",
    [actorId]
  );

  if (!actor.rows.length) return;

  const name = actor.rows[0].display_name || actor.rows[0].username;

  const notification = await createNotification({
    userId: targetUserId,
    actorId,
    type: "message",
    message: `${name} sent you a message`,
    link: `/messages.html`
  });

  const broadcast = req.app.get("broadcastNotification");
  if (broadcast) broadcast([targetUserId], { message: notification.message });

  return notification;
};


export default router;

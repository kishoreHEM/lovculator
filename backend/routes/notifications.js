import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";
import webpush from "../config/push.js";


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
        if (!req.user?.id) {
            return res.json({ success: true, count: 0 });
        }
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

        // 🔵 1️⃣ WebSocket Broadcast
        const broadcast = req?.app?.get("broadcastNotification");
        if (broadcast) {
            broadcast(userId, {
                type: "NEW_NOTIFICATION",
                notification
            });
        }

        // 🔔 2️⃣ PUSH NOTIFICATION
        try {
            const subs = await pool.query(
                "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
                [userId]
            );

            const payload = JSON.stringify({
                title: "Lovculator ❤️",
                body: message,
                icon: "/images/android-chrome-192x192.png",
                badge: "/images/android-chrome-192x192.png",
                url: link || "/notifications"
            });



            for (const sub of subs.rows) {
                const subscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                await webpush.sendNotification(subscription, payload)
    .catch(async err => {
        console.error("Push send error:", err.statusCode);

        // Remove invalid subscription
        if (err.statusCode === 410 || err.statusCode === 404) {
            await pool.query(
                "DELETE FROM push_subscriptions WHERE endpoint = $1",
                [sub.endpoint]
            );
        }
    });

            }

        } catch (pushErr) {
            console.error("Push system error:", pushErr);
        }

        return notification;

    } catch (error) {
        console.error("❌ createNotification error:", error);
        return null;
    }
};


/* ======================================================
   🔔 EXPORT NOTIFY SHORTCUTS (Fixed Links)
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
            // ✅ FIX: Use the clean URL route we created
            link: `/post/${postId}` 
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
            // ✅ FIX: Use the clean URL route
            link: `/post/${postId}`
        });
    } catch (err) {
        console.error("notifyComment failed:", err);
    }
};

export const notifyFollow = async (req, targetUserId, actorId) => {
    if (parseInt(targetUserId) === parseInt(actorId)) return;
    try {
        // Note: Ideally, you should pass the 'username' here if your profile URLs use usernames.
        // If your system supports IDs in the profile URL (e.g. /profile/123), this works.
        // Otherwise, you might need to fetch the username along with the name.
        
        const name = await fetchActorName(actorId); 
        
        return await createNotification(req, {
            userId: targetUserId,
            actorId,
            type: "follow",
            message: `${name} started following you`,
            // ✅ FIX: Removed .html. (Ensure your profile.js can handle IDs if actorId is an ID)
            link: `/profile/${actorId}`
        });
    } catch (err) {
        console.error("notifyFollow failed:", err);
    }
};

/* ======================================================
   📣 Notify ALL users (broadcast)
====================================================== */
export const notifyAllUsers = async (req, {
    actorId,
    type,
    message,
    link = null
}) => {
    try {
        // Insert notifications for everyone except the actor
        const insertRes = await pool.query(
            `
            INSERT INTO notifications (user_id, actor_id, type, message, link, is_read, created_at)
            SELECT id, $1, $2, $3, $4, false, NOW()
            FROM users
            WHERE id <> $1
            RETURNING user_id
            `,
            [actorId, type, message, link]
        );

        const recipients = insertRes.rows.map(r => r.user_id);

        const actorRes = await pool.query(
            "SELECT username, display_name, avatar_url FROM users WHERE id = $1",
            [actorId]
        );
        const actor = actorRes.rows[0] || {};

        const notification = {
            type,
            message,
            link,
            actor_username: actor.username,
            actor_display_name: actor.display_name,
            actor_avatar_url: actor.avatar_url
        };

        const broadcast = req?.app?.get("broadcastNotification");
        if (broadcast && recipients.length) {
            broadcast(recipients, {
                type: "NEW_NOTIFICATION",
                notification
            });
        }

        return recipients.length;
    } catch (err) {
        console.error("❌ notifyAllUsers failed:", err);
        return 0;
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


/**
 * Subscribe user to push notifications
 */
router.post("/subscribe", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription object" });
    }

    await pool.query(
      `
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, endpoint)
      DO NOTHING
      `,
      [userId, endpoint, keys.p256dh, keys.auth]
    );

    res.status(201).json({ success: true });

  } catch (err) {
    console.error("Push subscribe error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


export default router;

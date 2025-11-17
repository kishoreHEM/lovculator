// backend/routes/messages.js
import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   📨 1️⃣ Get all conversations for current user
====================================================== */
router.get("/conversations", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `
      SELECT 
        c.id,
        c.updated_at,
        ARRAY(
          SELECT JSON_BUILD_OBJECT(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url
          )
          FROM conversation_participants cp
          JOIN users u ON cp.user_id = u.id
          WHERE cp.conversation_id = c.id AND u.id != $1
        ) AS participants,
        (
  SELECT row_to_json(msg)
  FROM (
    SELECT 
      m.id,
      m.message_text,
      m.created_at,
      m.sender_id
    FROM messages m
    WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC
    LIMIT 1
  ) msg
) AS last_message,
        (
          SELECT COUNT(*)
          FROM messages m
          WHERE m.conversation_id = c.id 
            AND m.sender_id != $1
            AND m.is_read = false
        ) AS unread_count
      FROM conversations c
      WHERE c.id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = $1
      )
      ORDER BY c.updated_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    console.error("❌ Get conversations error:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/* ======================================================
   💬 2️⃣ Get or create conversation with another user
====================================================== */
router.post("/conversations", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: "Target user ID is required" });
    }

    if (userId === parseInt(targetUserId, 10)) {
      return res.status(400).json({ error: "Cannot start conversation with yourself" });
    }

    const userCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1",
      [targetUserId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const existing = await pool.query(
      `
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
      WHERE cp1.user_id = $1 AND cp2.user_id = $2
      `,
      [userId, targetUserId]
    );

    let conversationId;

    if (existing.rows.length > 0) {
      conversationId = existing.rows[0].id;
    } else {
      const newConv = await pool.query(
        "INSERT INTO conversations DEFAULT VALUES RETURNING id"
      );
      conversationId = newConv.rows[0].id;

      await pool.query(
        `
        INSERT INTO conversation_participants (conversation_id, user_id) 
        VALUES ($1, $2), ($1, $3)
        `,
        [conversationId, userId, targetUserId]
      );
    }

    res.json({ conversationId });
  } catch (error) {
    console.error("❌ Create conversation error:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

/* ======================================================
   📜 3️⃣ Get messages with pagination
====================================================== */
router.get("/conversations/:conversationId/messages", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 30;
    const before = req.query.before || null;

    const participantCheck = await pool.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    const params = [conversationId];
    let sql = `
      SELECT 
        m.*,
        u.username AS sender_username,
        u.display_name AS sender_display_name,
        u.avatar_url AS sender_avatar_url
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
        AND m.deleted_at IS NULL
    `;

    if (before) {
      params.push(before);
      sql += ` AND m.created_at < $2 `;
    }

    params.push(limit);
    sql += `ORDER BY m.created_at DESC LIMIT $${params.length}`;

    const { rows } = await pool.query(sql, params);

    await pool.query(
      `
      UPDATE messages 
      SET is_read = true 
      WHERE conversation_id = $1 
        AND sender_id != $2 
        AND is_read = false
      `,
      [conversationId, userId]
    );

    res.json(rows.reverse());
  } catch (error) {
    console.error("❌ Get messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/* ======================================================
   ✉️ 4️⃣ Send new message
====================================================== */
router.post("/conversations/:conversationId/messages", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { message_text } = req.body;

    if (!message_text?.trim()) {
      return res.status(400).json({ error: "Message text is required" });
    }

    const participantCheck = await pool.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO messages (conversation_id, sender_id, message_text)
      VALUES ($1, $2, $3)
      RETURNING *,
        (SELECT username FROM users WHERE id = $2) AS sender_username,
        (SELECT display_name FROM users WHERE id = $2) AS sender_display_name,
        (SELECT avatar_url FROM users WHERE id = $2) AS sender_avatar_url
      `,
      [conversationId, userId, message_text.trim()]
    );

    const message = rows[0];

    await pool.query(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [conversationId]
    );

    const { rows: others } = await pool.query(
      `
      SELECT user_id 
      FROM conversation_participants 
      WHERE conversation_id = $1 AND user_id <> $2
      `,
      [conversationId, userId]
    );

    const broadcastFn = req.app.get("broadcastNewMessage");
    if (broadcastFn) {
      broadcastFn(message, others.map((r) => r.user_id));
    }

    res.json(message);
  } catch (error) {
    console.error("❌ Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* ======================================================
   👁‍🗨 5️⃣ Mark messages as seen
====================================================== */
router.post("/conversations/:conversationId/seen", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const participantCheck = await pool.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      `
      UPDATE messages
      SET is_read = true
      WHERE conversation_id = $1
        AND sender_id != $2
        AND is_read = false
      RETURNING id, sender_id
      `,
      [conversationId, userId]
    );

    const broadcastSeen = req.app.get("broadcastSeenMessage");
    if (broadcastSeen) {
      rows.forEach((row) => {
        broadcastSeen(conversationId, row.id, row.sender_id);
      });
    }

    res.json({ updated: rows.length });
  } catch (error) {
    console.error("❌ Seen error:", error);
    res.status(500).json({ error: "Failed to mark seen" });
  }
});

/* ======================================================
   ✏️ 6️⃣ Edit a message
====================================================== */
router.put("/messages/:messageId", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { message_text } = req.body;

    if (!message_text?.trim()) {
      return res.status(400).json({ error: "Message text is required" });
    }

    const { rows } = await pool.query(
      `
      UPDATE messages
      SET message_text = $1, edited_at = NOW()
      WHERE id = $2 AND sender_id = $3
      RETURNING *
      `,
      [message_text.trim(), messageId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Not found or unauthorized" });
    }

    const message = rows[0];

    const { rows: others } = await pool.query(
      `
      SELECT user_id FROM conversation_participants
      WHERE conversation_id = $1 AND user_id <> $2
      `,
      [message.conversation_id, userId]
    );

    const broadcastEdit = req.app.get("broadcastEditedMessage");
    if (broadcastEdit) {
      broadcastEdit(message, others.map((u) => u.user_id));
    }

    res.json(message);
  } catch (error) {
    console.error("❌ Edit message error:", error);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

/* ======================================================
   🗑 7️⃣ Delete a message
====================================================== */
router.delete("/messages/:messageId", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    const { rows } = await pool.query(
      `
      UPDATE messages
      SET deleted_at = NOW(), message_text = '[deleted]'
      WHERE id = $1 AND sender_id = $2
      RETURNING *
      `,
      [messageId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Not found or unauthorized" });
    }

    const message = rows[0];

    const { rows: others } = await pool.query(
      `
      SELECT user_id FROM conversation_participants
      WHERE conversation_id = $1 AND user_id <> $2
      `,
      [message.conversation_id, userId]
    );

    const broadcastDelete = req.app.get("broadcastDeletedMessage");
    if (broadcastDelete) {
      broadcastDelete(message.id, others.map((u) => u.user_id));
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Delete message error:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

/* ======================================================
   🔔 8️⃣ Global unread count
====================================================== */
router.get("/unread-count", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM messages m
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
      WHERE cp.user_id = $1 
        AND m.sender_id != $1
        AND m.is_read = false
      `,
      [userId]
    );

    res.json({ count: parseInt(rows[0].count, 10) });
  } catch (error) {
    console.error("❌ Get unread count error:", error);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;

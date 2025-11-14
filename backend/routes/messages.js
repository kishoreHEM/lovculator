// backend/routes/messages.js
import express from "express";
import pool from '../db.js';
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
        ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url
          )
        ) AS participants,
        (
          SELECT JSON_BUILD_OBJECT(
            'id', m.id,
            'message_text', m.message_text,
            'created_at', m.created_at,
            'sender_id', m.sender_id
          )
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message,
        (
          SELECT COUNT(*)
          FROM messages m
          WHERE m.conversation_id = c.id 
          AND m.sender_id != $1
          AND m.is_read = false
        ) AS unread_count
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      JOIN users u ON cp.user_id = u.id
      WHERE c.id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = $1
      )
      GROUP BY c.id
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

    if (userId === parseInt(targetUserId)) {
      return res.status(400).json({ error: "Cannot start conversation with yourself" });
    }

    // Check if target user exists
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
   📜 3️⃣ Get all messages for a conversation
====================================================== */
router.get("/conversations/:conversationId/messages", auth, async (req, res) => {
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
      SELECT 
        m.*,
        u.username AS sender_username,
        u.display_name AS sender_display_name,
        u.avatar_url AS sender_avatar_url
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      `,
      [conversationId]
    );

    // Mark messages as read
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

    res.json(rows);
  } catch (error) {
    console.error("❌ Get messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/* ======================================================
   ✉️ 4️⃣ Send a new message
====================================================== */
router.post("/conversations/:conversationId/messages", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { message_text } = req.body;

    if (!message_text?.trim()) {
      return res.status(400).json({ error: "Message text is required" });
    }

    if (message_text.trim().length > 1000) {
      return res.status(400).json({ error: "Message too long (max 1000 characters)" });
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

    // Update conversation timestamp
    await pool.query(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", 
      [conversationId]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* ======================================================
   🔔 5️⃣ Get unread message count
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

    res.json({ count: parseInt(rows[0].count) });
  } catch (error) {
    console.error("❌ Get unread count error:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

/* ======================================================
   👥 6️⃣ Get conversation participants
====================================================== */
router.get("/conversations/:conversationId/participants", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    // Verify user is participant
    const participantCheck = await pool.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      `
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.bio
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id = $1 AND u.id != $2
      `,
      [conversationId, userId]
    );

    res.json(rows[0] || null); // Return the other participant
  } catch (error) {
    console.error("❌ Get participants error:", error);
    res.status(500).json({ error: "Failed to fetch participants" });
  }
});

export default router;
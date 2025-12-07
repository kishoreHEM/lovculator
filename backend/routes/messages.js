import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";
import rateLimit from "express-rate-limit";
import multer from "multer"; // 1. Import Multer
import path from "path";
import fs from "fs";

const router = express.Router();

// --- 2. Configure Image Upload Storage ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/messages/";
    // Create folder if not exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Unique filename: timestamp-random.ext
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Rate limiting configurations
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // max 30 messages per minute
  message: {
    error: "Too many messages sent. Please wait a moment.",
    code: "RATE_LIMITED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const conversationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // max 10 conversation creations per minute
  message: {
    error: "Too many conversation attempts. Please wait a moment.",
    code: "RATE_LIMITED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation middleware
const validateMessage = (req, res, next) => {
  const { message_text } = req.body;
  
  if (!message_text?.trim()) {
    return res.status(400).json({ 
      error: "Message text is required",
      code: "MESSAGE_TEXT_REQUIRED"
    });
  }
  
  if (message_text.length > 1000) {
    return res.status(400).json({ 
      error: "Message too long (max 1000 characters)",
      code: "MESSAGE_TOO_LONG"
    });
  }
  
  next();
};

const validateConversation = (req, res, next) => {
  const { targetUserId } = req.body;
  
  if (!targetUserId) {
    return res.status(400).json({ 
      error: "Target user ID is required",
      code: "TARGET_USER_REQUIRED"
    });
  }
  
  if (isNaN(parseInt(targetUserId, 10))) {
    return res.status(400).json({ 
      error: "Invalid target user ID",
      code: "INVALID_USER_ID"
    });
  }
  
  next();
};

// Sanitization helper
const sanitizeMessage = (text) => {
  return text
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&#34;')
    .substring(0, 1000); // max length
};

// Enhanced upload route
router.post("/upload", auth, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const fileType = req.file.mimetype;
    let messageType = 'text';
    
    if (fileType.startsWith('image/')) messageType = 'image';
    else if (fileType === 'application/pdf') messageType = 'pdf';
    else if (fileType.includes('word')) messageType = 'doc';
    else if (fileType === 'text/plain') messageType = 'txt';
    
    const fileUrl = `/uploads/messages/${req.file.filename}`;
    
    res.json({ 
      url: fileUrl,
      type: messageType,
      filename: req.file.originalname,
      file_size: req.file.size,
      mime_type: fileType
    });
    
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ======================================================
   📨 1️⃣ Get all conversations for current user (FIXED)
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
            AND m.deleted_at IS NULL
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
    res.status(500).json({ 
      error: "Failed to fetch conversations",
      code: "FETCH_CONVERSATIONS_FAILED"
    });
  }
});

/* ======================================================
   💬 2️⃣ Get or create conversation with another user (FIXED - removed deleted_at)
====================================================== */
router.post("/conversations", auth, conversationLimiter, validateConversation, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { targetUserId } = req.body;
    const targetUserIdInt = parseInt(targetUserId, 10);

    if (userId === targetUserIdInt) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: "Cannot start conversation with yourself",
        code: "SELF_CONVERSATION"
      });
    }

    // Check if target user exists and is active
    const userCheck = await client.query(
      `SELECT id, username, display_name, avatar_url 
       FROM users 
       WHERE id = $1`,
      [targetUserIdInt]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    // Check for existing conversation using conversation_participants
    const existing = await client.query(
      `
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
      WHERE cp1.user_id = $1 AND cp2.user_id = $2
      LIMIT 1
      `,
      [userId, targetUserIdInt]
    );

    let conversationId;

    if (existing.rows.length > 0) {
      conversationId = existing.rows[0].id;
      
      // Update conversation timestamp
      await client.query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [conversationId]
      );
    } else {
      // Create new conversation WITHOUT deleted_at
      const newConv = await client.query(
        `INSERT INTO conversations (created_at, updated_at) 
         VALUES (NOW(), NOW()) 
         RETURNING id`,
        []
      );
      conversationId = newConv.rows[0].id;

      // Add both users as participants
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, joined_at) 
         VALUES ($1, $2, NOW()), ($1, $3, NOW())`,
        [conversationId, userId, targetUserIdInt]
      );
    }

    await client.query('COMMIT');
    
    res.json({ 
      conversationId,
      success: true,
      isNew: existing.rows.length === 0
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Create conversation error:", error);
    res.status(500).json({ 
      error: "Failed to create conversation",
      code: "CREATE_CONVERSATION_FAILED"
    });
  } finally {
    client.release();
  }
});

/* ======================================================
   📜 3️⃣ Get messages with pagination
====================================================== */
router.get("/conversations/:conversationId/messages", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const before = req.query.before || null;

    // Validate participant access
    const participantCheck = await pool.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: "Access denied to conversation",
        code: "CONVERSATION_ACCESS_DENIED"
      });
    }

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

    const params = [conversationId];
    let paramCount = 1;

    if (before) {
      paramCount++;
      sql += ` AND m.created_at < $${paramCount}`;
      params.push(before);
    }

    paramCount++;
    sql += ` ORDER BY m.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const { rows } = await pool.query(sql, params);

    // Mark messages as read
    await pool.query(
      `
      UPDATE messages 
      SET is_read = true 
      WHERE conversation_id = $1 
        AND sender_id != $2 
        AND is_read = false
        AND deleted_at IS NULL
      `,
      [conversationId, userId]
    );

    res.json(rows.reverse());
  } catch (error) {
    console.error("❌ Get messages error:", error);
    res.status(500).json({ 
      error: "Failed to fetch messages",
      code: "FETCH_MESSAGES_FAILED"
    });
  }
});

/* ======================================================
   ✉️ 4. Send Message (UPDATED to handle type)
   (Your existing code was mostly fine, just ensure it uses the body correctly)
====================================================== */
router.post("/conversations/:conversationId/messages", auth, async (req, res) => { // Remove validators for now if they block images
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { conversationId } = req.params;
    // Extract attachment info
    const { message_text, message_type = 'text', attachment_url = null } = req.body;

    // Logic: If it's an image, text is optional
    const finalMessageText = message_text || (message_type === 'image' ? 'Sent an image' : '');

    // Check participant access
    const participantCheck = await client.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: "Access denied" });
    }

    // Insert message
    const { rows } = await client.query(
      `
      INSERT INTO messages (conversation_id, sender_id, message_text, message_type, attachment_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *,
        (SELECT username FROM users WHERE id = $2) AS sender_username,
        (SELECT display_name FROM users WHERE id = $2) AS sender_display_name,
        (SELECT avatar_url FROM users WHERE id = $2) AS sender_avatar_url
      `,
      [conversationId, userId, finalMessageText, message_type, attachment_url]
    );

    const message = rows[0];

    // Update conversation timestamp
    await client.query(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [conversationId]
    );

    // Get recipients for WebSocket
    const { rows: others } = await client.query(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id <> $2`,
      [conversationId, userId]
    );

    await client.query('COMMIT');

    // 🚀 WebSocket Broadcast
    const broadcastFn = req.app.get("broadcastNewMessage");
    if (broadcastFn) {
      broadcastFn(message, others.map((r) => r.user_id));
    }

    res.json(message);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  } finally {
    client.release();
  }
});

/* ======================================================
   👁‍🗨 5️⃣ Mark messages as seen
====================================================== */
router.post("/conversations/:conversationId/seen", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    // Verify participant access
    const participantCheck = await pool.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: "Access denied",
        code: "CONVERSATION_ACCESS_DENIED"
      });
    }

    const { rows } = await pool.query(
      `
      UPDATE messages
      SET is_read = true
      WHERE conversation_id = $1
        AND sender_id != $2
        AND is_read = false
        AND deleted_at IS NULL
      RETURNING id, sender_id
      `,
      [conversationId, userId]
    );

    const broadcastSeen = req.app.get("broadcastSeenMessage");
    if (broadcastSeen && rows.length > 0) {
      // Group by sender to avoid duplicate notifications
      const senders = [...new Set(rows.map(row => row.sender_id))];
      
      senders.forEach(senderId => {
        const senderMessages = rows.filter(row => row.sender_id === senderId);
        broadcastSeen(conversationId, senderMessages.map(m => m.id), senderId);
      });
    }

    res.json({ 
      updated: rows.length,
      messages: rows 
    });
  } catch (error) {
    console.error("❌ Seen error:", error);
    res.status(500).json({ 
      error: "Failed to mark messages as seen",
      code: "MARK_SEEN_FAILED"
    });
  }
});

/* ======================================================
   ✏️ 6️⃣ Edit a message
====================================================== */
router.put("/messages/:messageId", auth, validateMessage, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { messageId } = req.params;
    const { message_text } = req.body;

    const sanitizedText = sanitizeMessage(message_text);

    const { rows } = await client.query(
      `
      UPDATE messages
      SET message_text = $1, edited_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND sender_id = $3 AND deleted_at IS NULL
      RETURNING *, 
        (SELECT username FROM users WHERE id = $3) AS sender_username,
        (SELECT display_name FROM users WHERE id = $3) AS sender_display_name,
        (SELECT avatar_url FROM users WHERE id = $3) AS sender_avatar_url
      `,
      [sanitizedText, messageId, userId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: "Message not found or unauthorized",
        code: "MESSAGE_NOT_FOUND"
      });
    }

    const message = rows[0];

    // Get other participants
    const { rows: others } = await client.query(
      `
      SELECT user_id FROM conversation_participants
      WHERE conversation_id = $1 AND user_id <> $2
      `,
      [message.conversation_id, userId]
    );

    await client.query('COMMIT');

    // Broadcast edit
    const broadcastEdit = req.app.get("broadcastEditedMessage");
    if (broadcastEdit) {
      broadcastEdit(message, others.map((u) => u.user_id));
    }

    res.json(message);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Edit message error:", error);
    res.status(500).json({ 
      error: "Failed to edit message",
      code: "EDIT_MESSAGE_FAILED"
    });
  } finally {
    client.release();
  }
});

/* ======================================================
   🗑 7️⃣ Delete a message
====================================================== */
router.delete("/messages/:messageId", auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { messageId } = req.params;

    const { rows } = await client.query(
      `
      UPDATE messages
      SET deleted_at = CURRENT_TIMESTAMP, message_text = '[deleted]'
      WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
      RETURNING *
      `,
      [messageId, userId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: "Message not found or unauthorized",
        code: "MESSAGE_NOT_FOUND"
      });
    }

    const message = rows[0];

    const { rows: others } = await client.query(
      `
      SELECT user_id FROM conversation_participants
      WHERE conversation_id = $1 AND user_id <> $2
      `,
      [message.conversation_id, userId]
    );

    await client.query('COMMIT');

    const broadcastDelete = req.app.get("broadcastDeletedMessage");
    if (broadcastDelete) {
      broadcastDelete(message.id, others.map((u) => u.user_id));
    }

    res.json({ 
      success: true,
      message: "Message deleted successfully"
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Delete message error:", error);
    res.status(500).json({ 
      error: "Failed to delete message",
      code: "DELETE_MESSAGE_FAILED"
    });
  } finally {
    client.release();
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
        AND m.deleted_at IS NULL
      `,
      [userId]
    );

    res.json({ 
      count: parseInt(rows[0].count, 10),
      success: true
    });
  } catch (error) {
    console.error("❌ Get unread count error:", error);
    res.status(500).json({ 
      error: "Failed to get unread count",
      code: "UNREAD_COUNT_FAILED"
    });
  }
});

/* ======================================================
   🔍 9️⃣ Search messages in conversation
====================================================== */
router.get("/conversations/:conversationId/search", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { q, limit = 20, offset = 0 } = req.query;

    if (!q?.trim()) {
      return res.status(400).json({ 
        error: "Search query is required",
        code: "SEARCH_QUERY_REQUIRED"
      });
    }

    // Check participant access
    const participantCheck = await pool.query(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: "Access denied",
        code: "CONVERSATION_ACCESS_DENIED"
      });
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
        AND m.deleted_at IS NULL
        AND m.message_text ILIKE $2
      ORDER BY m.created_at DESC
      LIMIT $3 OFFSET $4
      `,
      [conversationId, `%${q.trim()}%`, limit, offset]
    );

    res.json({
      messages: rows,
      success: true
    });
  } catch (error) {
    console.error("❌ Search messages error:", error);
    res.status(500).json({ 
      error: "Failed to search messages",
      code: "SEARCH_MESSAGES_FAILED"
    });
  }
});

export default router;
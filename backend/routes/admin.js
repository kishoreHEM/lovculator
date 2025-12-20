import express from "express";
import pool from "../db.js";
import { isAdmin } from "../middleware/isAdmin.js";

const router = express.Router();

/* =============================
   1. GET USERS
============================= */
router.get("/users", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, username, email, is_admin, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Admin list users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/* =============================
   2. DELETE USER (Deep Cleanup)
============================= */
router.delete("/users/:id", isAdmin, async (req, res) => {
  const userId = Number(req.params.id);

  if (req.session.user && req.session.user.id === userId) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Delete Messages
    await client.query("DELETE FROM direct_messages WHERE sender_id=$1 OR receiver_id=$1", [userId]);

    // 2. Delete Story Interactions
    await client.query("DELETE FROM story_comments WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM story_likes WHERE user_id=$1", [userId]);

    // 3. ✅ DELETE Q&A INTERACTIONS (Based on your screenshots)
    // Delete likes/comments MADE BY the user
    await client.query("DELETE FROM answer_likes WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM answer_comments WHERE user_id=$1", [userId]);

    // Delete likes/comments ON the user's answers
    await client.query(`
      DELETE FROM answer_likes WHERE answer_id IN (SELECT id FROM answers WHERE user_id = $1)
    `, [userId]);
    await client.query(`
      DELETE FROM answer_comments WHERE answer_id IN (SELECT id FROM answers WHERE user_id = $1)
    `, [userId]);

    // 4. ✅ DELETE ANSWERS (Now safe to delete)
    await client.query("DELETE FROM answers WHERE user_id=$1", [userId]);

    // 5. ✅ DELETE QUESTIONS (And all related answers by OTHERS)
    // First, clean up answers attached to questions OWNED by this user
    await client.query(`
      DELETE FROM answer_likes WHERE answer_id IN (
        SELECT id FROM answers WHERE question_id IN (SELECT id FROM questions WHERE user_id = $1)
      )
    `, [userId]);
    await client.query(`
      DELETE FROM answer_comments WHERE answer_id IN (
        SELECT id FROM answers WHERE question_id IN (SELECT id FROM questions WHERE user_id = $1)
      )
    `, [userId]);
    await client.query(`
      DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE user_id = $1)
    `, [userId]);
    
    // Now safe to delete the questions
    await client.query("DELETE FROM questions WHERE user_id=$1", [userId]);

    // 6. Delete Posts
    await client.query("DELETE FROM posts WHERE user_id=$1", [userId]);

    // 7. Delete Stories
    await client.query("DELETE FROM stories WHERE user_id=$1", [userId]);

    // 8. Delete Relationships (Follows & Requests)
    await client.query("DELETE FROM follows WHERE follower_id=$1 OR target_id=$1", [userId]);
    await client.query("DELETE FROM friend_requests WHERE sender_id=$1 OR receiver_id=$1", [userId]);

    // 9. Delete System Data
    await client.query("DELETE FROM notifications WHERE user_id=$1 OR actor_id=$1", [userId]);
    await client.query("DELETE FROM page_visits WHERE user_id=$1", [userId]);

    // 10. Finally, Delete User
    await client.query("DELETE FROM users WHERE id=$1", [userId]);

    await client.query("COMMIT");
    res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Admin delete user error:", err.message);
    res.status(500).json({ error: `Failed to delete user: ${err.message}` });
  } finally {
    client.release();
  }
});

/* =============================
   3. BULK DELETE TEST USERS
============================= */
router.delete("/cleanup/test-users", isAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(`
      SELECT id FROM users
      WHERE email ILIKE '%test%' OR email ILIKE '%example%'
    `);

    for (const { id } of rows) {
      // Repeat the exact cleanup logic for each test user
      await client.query("DELETE FROM direct_messages WHERE sender_id=$1 OR receiver_id=$1", [id]);
      await client.query("DELETE FROM story_comments WHERE user_id=$1", [id]);
      await client.query("DELETE FROM story_likes WHERE user_id=$1", [id]);
      
      // Q&A Cleanup
      await client.query("DELETE FROM answer_likes WHERE user_id=$1", [id]);
      await client.query("DELETE FROM answer_comments WHERE user_id=$1", [id]);
      await client.query(`DELETE FROM answer_likes WHERE answer_id IN (SELECT id FROM answers WHERE user_id = $1)`, [id]);
      await client.query(`DELETE FROM answer_comments WHERE answer_id IN (SELECT id FROM answers WHERE user_id = $1)`, [id]);
      await client.query("DELETE FROM answers WHERE user_id=$1", [id]);
      
      // Questions Cleanup
      await client.query(`DELETE FROM answer_likes WHERE answer_id IN (SELECT id FROM answers WHERE question_id IN (SELECT id FROM questions WHERE user_id = $1))`, [id]);
      await client.query(`DELETE FROM answer_comments WHERE answer_id IN (SELECT id FROM answers WHERE question_id IN (SELECT id FROM questions WHERE user_id = $1))`, [id]);
      await client.query(`DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE user_id = $1)`, [id]);
      await client.query("DELETE FROM questions WHERE user_id=$1", [id]);

      await client.query("DELETE FROM posts WHERE user_id=$1", [id]);
      await client.query("DELETE FROM stories WHERE user_id=$1", [id]);
      
      await client.query("DELETE FROM follows WHERE follower_id=$1 OR target_id=$1", [id]);
      await client.query("DELETE FROM friend_requests WHERE sender_id=$1 OR receiver_id=$1", [id]);
      await client.query("DELETE FROM notifications WHERE user_id=$1 OR actor_id=$1", [id]);
      await client.query("DELETE FROM page_visits WHERE user_id=$1", [id]);
      
      await client.query("DELETE FROM users WHERE id=$1", [id]);
    }

    await client.query("COMMIT");
    res.json({ success: true, deleted: rows.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Admin bulk delete error:", err);
    res.status(500).json({ error: "Failed to delete test users" });
  } finally {
    client.release();
  }
});

/* =============================
   CONTENT ROUTES
============================= */

// --- STORIES ---
router.get("/stories", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.story_title, left(s.love_story, 50) as snippet, u.username, s.created_at
      FROM stories s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Error loading stories" }); }
});
router.delete("/stories/:id", isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM story_comments WHERE story_id=$1", [req.params.id]);
    await pool.query("DELETE FROM story_likes WHERE story_id=$1", [req.params.id]);
    await pool.query("DELETE FROM stories WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Error deleting story" }); }
});

// --- POSTS ---
router.get("/posts", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, left(p.content, 50) as content, u.username, p.created_at
      FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Error loading posts" }); }
});
router.delete("/posts/:id", isAdmin, async (req, res) => {
  try {
    // If you add post_likes later, delete them here first
    await pool.query("DELETE FROM posts WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Error deleting post" }); }
});

// --- QUESTIONS (FIXED: Using correct column 'question') ---
router.get("/questions", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT q.id, left(q.question, 50) as question, u.username, q.created_at
      FROM questions q JOIN users u ON q.user_id = u.id ORDER BY q.created_at DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Error loading questions" }); }
});

router.delete("/questions/:id", isAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const qid = req.params.id;
    
    // Clean up all answers linked to this question (and their likes/comments)
    await client.query(`DELETE FROM answer_likes WHERE answer_id IN (SELECT id FROM answers WHERE question_id=$1)`, [qid]);
    await client.query(`DELETE FROM answer_comments WHERE answer_id IN (SELECT id FROM answers WHERE question_id=$1)`, [qid]);
    await client.query(`DELETE FROM answers WHERE question_id=$1`, [qid]);
    
    // Finally delete question
    await client.query("DELETE FROM questions WHERE id=$1", [qid]);
    
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) { 
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Error deleting question" }); 
  } finally {
    client.release();
  }
});

// --- COMMENTS ---
router.get("/comments", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, left(c.comment_text, 50) as text, u.username, c.created_at
      FROM story_comments c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Error loading comments" }); }
});
router.delete("/comments/:id", isAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM story_comments WHERE id=$1", [req.params.id]); res.json({ success: true }); } 
  catch (err) { res.status(500).json({ error: "Error deleting comment" }); }
});

// --- FOLLOWS ---
router.get("/follows", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.id, follower.username as follower, target.username as following, f.created_at
      FROM follows f
      JOIN users follower ON f.follower_id = follower.id
      JOIN users target ON f.target_id = target.id
      ORDER BY f.created_at DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Error loading follows" }); }
});
router.delete("/follows/:id", isAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM follows WHERE id=$1", [req.params.id]); res.json({ success: true }); } 
  catch (err) { res.status(500).json({ error: "Error deleting follow" }); }
});

// --- LIKES ---
router.get("/likes", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT l.id, u.username, s.story_title, l.created_at
      FROM story_likes l JOIN users u ON l.user_id = u.id JOIN stories s ON l.story_id = s.id ORDER BY l.created_at DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Error loading likes" }); }
});
router.delete("/likes/:id", isAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM story_likes WHERE id=$1", [req.params.id]); res.json({ success: true }); } 
  catch (err) { res.status(500).json({ error: "Error deleting like" }); }
});

export default router;
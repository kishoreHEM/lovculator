import express from "express";
import pool from "../db.js";
import { isAdmin } from "../middleware/isAdmin.js";
import fs from "fs";
import path from "path";

const router = express.Router();

/* =============================
   LIST USERS
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
   DELETE SINGLE USER (CASCADE)
============================= */
router.delete("/users/:id", isAdmin, async (req, res) => {
  const userId = Number(req.params.id);

  // 🛑 Prevent admin from deleting themselves
  if (userId === req.session.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM direct_messages WHERE sender_id=$1 OR receiver_id=$1", [userId]);
    await client.query("DELETE FROM story_comments WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM story_likes WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM follows WHERE follower_id=$1 OR following_id=$1", [userId]);
    await client.query("DELETE FROM friend_requests WHERE sender_id=$1 OR receiver_id=$1", [userId]);
    await client.query("DELETE FROM stories WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM users WHERE id=$1", [userId]);

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Admin delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  } finally {
    client.release();
  }
});

/* =============================
   BULK DELETE TEST USERS
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
      await client.query("DELETE FROM direct_messages WHERE sender_id=$1 OR receiver_id=$1", [id]);
      await client.query("DELETE FROM story_comments WHERE user_id=$1", [id]);
      await client.query("DELETE FROM story_likes WHERE user_id=$1", [id]);
      await client.query("DELETE FROM follows WHERE follower_id=$1 OR following_id=$1", [id]);
      await client.query("DELETE FROM friend_requests WHERE sender_id=$1 OR receiver_id=$1", [id]);
      await client.query("DELETE FROM stories WHERE user_id=$1", [id]);
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
   DELETE TEST IMAGES
============================= */
router.delete("/cleanup/images", isAdmin, async (req, res) => {
  try {
    const baseUploadPath = path.join(process.cwd(), "uploads");
    const folders = ["avatars", "stories"];

    folders.forEach((folder) => {
      const dir = path.join(baseUploadPath, folder);
      if (fs.existsSync(dir)) {
        // Only delete files, try to keep the folder structure
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Admin delete images error:", err);
    res.status(500).json({ error: "Failed to delete images" });
  }
});

/* =============================
   1. MANAGE LOVE STORIES
============================= */
router.get("/stories", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.story_title, left(s.love_story, 50) as snippet, 
             u.username, s.created_at
      FROM stories s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load stories" });
  }
});

router.delete("/stories/:id", isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    // Delete related likes/comments first
    await pool.query("DELETE FROM story_comments WHERE story_id=$1", [id]);
    await pool.query("DELETE FROM story_likes WHERE story_id=$1", [id]);
    await pool.query("DELETE FROM stories WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete story" });
  }
});

/* =============================
   2. MANAGE COMMENTS
============================= */
router.get("/comments", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, left(c.comment_text, 50) as text, 
             u.username, c.created_at
      FROM story_comments c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load comments" });
  }
});

router.delete("/comments/:id", isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM story_comments WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

/* =============================
   3. MANAGE FOLLOWS
============================= */
router.get("/follows", isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.id, follower.username as follower, following.username as following, f.created_at
      FROM follows f
      JOIN users follower ON f.follower_id = follower.id
      JOIN users following ON f.following_id = following.id
      ORDER BY f.created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load follows" });
  }
});

router.delete("/follows/:id", isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM follows WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove follow" });
  }
});

/* =============================
   4. MANAGE LIKES (Stats View)
============================= */
router.get("/likes", isAdmin, async (req, res) => {
  try {
    // Listing every single like can crash the browser, so we list recent 100
    const { rows } = await pool.query(`
      SELECT l.id, u.username, s.story_title, l.created_at
      FROM story_likes l
      JOIN users u ON l.user_id = u.id
      JOIN stories s ON l.story_id = s.id
      ORDER BY l.created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load likes" });
  }
});

router.delete("/likes/:id", isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM story_likes WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove like" });
  }
});

export default router;
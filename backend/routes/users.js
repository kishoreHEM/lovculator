// backend/routes/users.js
import express from "express";
import pool from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { notifyFollow } from './notifications.js';

const router = express.Router();

/* ======================================================
   🔒 Middleware: Authentication Check
====================================================== */
const isAuthenticated = (req, res, next) => {
  const userId = req.session?.userId || req.session?.user?.id;
  if (userId) {
    req.user = { id: userId };
    return next();
  }
  res.status(401).json({ error: "Unauthorized: Please log in." });
};

/* ======================================================
   🧠 AVATAR UPLOAD CONFIGURATION (New)
====================================================== */
const avatarDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, or WebP allowed"));
    }
    cb(null, true);
  },
});

/* ======================================================
   1️⃣ FETCH ALL USERS (Public Info Only)
   Supports pagination
====================================================== */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        display_name,
        bio,
        location,
        relationship_status,
        gender,
        work_education,
        avatar_url,
        follower_count,
        following_count,
        created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    // Attach profile completion (derived, not stored)
    const users = result.rows.map(user => ({
      ...user,
      profile_completion: calculateProfileCompletion(user)
    }));

    res.json({
      page,
      limit,
      count: users.length,
      users
    });

  } catch (err) {
    console.error("❌ Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});


/* ======================================================
   2️⃣ FETCH SINGLE USER PROFILE (with counts)
====================================================== */
router.get("/profile/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const { rows } = await pool.query(
      `
      SELECT 
        u.id, u.username, u.display_name, u.bio, u.location,
        u.work_education, u.gender, u.relationship_status,
        u.avatar_url, u.created_at,
        (SELECT COUNT(*) FROM follows WHERE target_id = u.id) AS follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count,
        (SELECT COUNT(*) FROM stories WHERE user_id = u.id) AS stories_count
      FROM users u
      WHERE LOWER(u.username) = LOWER($1)
      LIMIT 1
      `,
      [username]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];
    const currentUserId = req.session?.user?.id || req.session?.userId;

    user.is_own_profile = currentUserId === user.id;
    user.is_following_author =
      currentUserId && currentUserId !== user.id
        ? (await pool.query(
            "SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2",
            [currentUserId, user.id]
          )).rowCount > 0
        : false;

    user.profile_completion = calculateProfileCompletion(user);

    res.json(user);

  } catch (err) {
    console.error("❌ Fetch user profile error:", err);
    res.status(500).json({ error: "Failed to load user profile." });
  }
});

/* ======================================================
   2️⃣b FETCH USER HOVER CARD (Public)
   Endpoint: GET /api/users/hover/:username
====================================================== */
router.get("/hover/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.session?.user?.id || req.session?.userId;

    const { rows } = await pool.query(
      `
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.bio,
        u.location,
        u.work_education,
        u.avatar_url,
        u.created_at,
        (SELECT COUNT(*) FROM follows WHERE target_id = u.id) AS follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count,
        (SELECT COUNT(*) FROM answers WHERE user_id = u.id) AS answers_count,
        (SELECT COUNT(*) FROM questions WHERE user_id = u.id) AS questions_count,
        (SELECT COUNT(*) FROM stories WHERE user_id = u.id) AS stories_count,
        (
          SELECT COUNT(*)
          FROM question_views v
          JOIN answers a ON a.question_id = v.question_id
          WHERE a.user_id = u.id
        ) AS views_count
      FROM users u
      WHERE LOWER(u.username) = LOWER($1)
      LIMIT 1
      `,
      [username]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];
    user.is_following_author =
      currentUserId && currentUserId !== user.id
        ? (await pool.query(
            "SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2",
            [currentUserId, user.id]
          )).rowCount > 0
        : false;

    res.json(user);
  } catch (err) {
    console.error("❌ Hover card error:", err);
    res.status(500).json({ error: "Failed to load hover card." });
  }
});

/* ======================================================
   🔎 SEARCH USERS (Public)
   Endpoint: GET /api/users/search?q=john
====================================================== */
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();

    // Guard: minimum 2 characters
    if (q.length < 2) {
      return res.json([]);
    }

    const limit = Math.min(parseInt(req.query.limit) || 5, 10);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        username,
        display_name,
        avatar_url,
        bio,
        work_education,
        gender
      FROM users
      WHERE
        username ILIKE $1
        OR display_name ILIKE $1
      ORDER BY
        CASE
          WHEN username ILIKE $2 THEN 0
          ELSE 1
        END,
        follower_count DESC
      LIMIT $3
      `,
      [
        `%${q}%`,   // contains match
        `${q}%`,    // starts-with boost
        limit
      ]
    );

    const users = rows.map(user => ({
      ...user,
      profile_completion: calculateProfileCompletion(user)
    }));

    res.json(users);

  } catch (err) {
    console.error("❌ Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});


/* ======================================================
   3️⃣ UPDATE USER PROFILE (Requires Auth) - EXTENDED & SAFE
====================================================== */
import { calculateProfileCompletion } from "../utils/profileCompletion.js";

router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (userId !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized action" });
    }

    const {
      display_name,
      bio,
      location,
      relationship_status,
      gender,
      date_of_birth,
      work_education
    } = req.body;

    const { rows } = await pool.query(
      `
      UPDATE users
      SET
        display_name = COALESCE($1, display_name),
        bio = COALESCE($2, bio),
        location = COALESCE($3, location),
        relationship_status = COALESCE($4, relationship_status),
        gender = COALESCE($5, gender),
        date_of_birth = COALESCE($6, date_of_birth),
        work_education = COALESCE($7, work_education),
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
      `,
      [
        display_name,
        bio,
        location,
        relationship_status,
        gender,
        date_of_birth,
        work_education,
        userId
      ]
    );

    const user = rows[0];
    const profile_completion = calculateProfileCompletion(user);

    res.json({
      success: true,
      user,
      profile_completion
    });
  } catch (err) {
    console.error("❌ Profile update error:", err);
    res.status(500).json({ error: "Profile update failed" });
  }
});


/* ======================================================
   4️⃣ UPLOAD PROFILE AVATAR (CSP + CDN Safe)
====================================================== */
router.post("/:id/avatar", isAuthenticated, upload.single("avatar"), async (req, res) => {
  if (req.user.id !== Number(req.params.id)) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No avatar file uploaded" });
  }

  try {
    const userId = Number(req.params.id);
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    const result = await pool.query(
      `
      UPDATE users
      SET avatar_url = $1
      WHERE id = $2
      RETURNING id, username, display_name, bio, location,
                relationship_status, work_education, gender,
                follower_count, following_count, avatar_url, created_at
      `,
      [avatarPath, userId]
    );

    const user = result.rows[0];
    const profile_completion = calculateProfileCompletion(user);

    res.json({
      success: true,
      message: "Avatar updated successfully.",
      avatar_url: avatarPath,
      user,
      profile_completion
    });

  } catch (err) {
    console.error("❌ Avatar upload error:", err);
    res.status(500).json({ error: "Failed to upload avatar." });
  }
});


/* ======================================================
   5️⃣ FOLLOW / UNFOLLOW TOGGLE (Enhanced)
====================================================== */
router.post("/:targetId/follow", isAuthenticated, async (req, res) => {
  const followerId = req.user.id;
  const targetId = parseInt(req.params.targetId);

  if (followerId === targetId) {
    return res.status(400).json({ error: "You cannot follow yourself." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const check = await client.query(
      "SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2",
      [followerId, targetId]
    );

    let isFollowing;

    if (check.rowCount > 0) {
      await client.query(
        "DELETE FROM follows WHERE follower_id = $1 AND target_id = $2",
        [followerId, targetId]
      );
      isFollowing = false;
    } else {
      await client.query(
        "INSERT INTO follows (follower_id, target_id, created_at) VALUES ($1, $2, NOW())",
        [followerId, targetId]
      );
      isFollowing = true;
    }

    await client.query(`
      UPDATE users
      SET follower_count = (SELECT COUNT(*) FROM follows WHERE target_id = users.id),
          following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = users.id)
      WHERE id IN ($1, $2);
    `, [followerId, targetId]);

    await client.query("COMMIT");

    // call notify only AFTER COMMIT
    if (isFollowing) {
      // notifyFollow signature: (req, targetUserId, actorId)
      await notifyFollow(req, targetId, followerId);
    }

    return res.json({
      success: true,
      is_following: isFollowing
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Follow/Unfollow transaction error:", err);
    return res.status(500).json({ error: "Failed to toggle follow status." });
  } finally {
    client.release();
  }
});

/* ======================================================
   6️⃣ FETCH FOLLOWERS LIST
====================================================== */
router.get("/:userId/followers", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
      FROM follows f
      JOIN users u ON u.id = f.follower_id
      WHERE f.target_id = $1
      ORDER BY u.username ASC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch followers error:", err);
    res.status(500).json({ error: "Failed to fetch followers list" });
  }
});

/* ======================================================
   7️⃣ FETCH FOLLOWING LIST
====================================================== */
router.get("/:userId/following", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
      FROM follows f
      JOIN users u ON u.id = f.target_id
      WHERE f.follower_id = $1
      ORDER BY u.username ASC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch following error:", err);
    res.status(500).json({ error: "Failed to fetch following list" });
  }
});

/* ======================================================
   8️⃣ CHECK FOLLOW STATUS
====================================================== */
router.get("/:targetId/is-following", async (req, res) => {
  const followerId = req.session?.userId;
  const targetId = req.params.targetId;

  if (!followerId) return res.json({ is_following: false });

  try {
    const result = await pool.query(
      "SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2",
      [followerId, targetId]
    );
    res.json({ is_following: result.rowCount > 0 });
  } catch (err) {
    console.error("❌ Error checking follow status:", err);
    res.status(500).json({ error: "Failed to check follow status" });
  }
});

/* ======================================================
   9️⃣ USER ACTIVITY FEED
====================================================== */
router.get("/:id/activity", async (req, res) => {
  const targetId = Number(req.params.id);

  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const followersResult = await pool.query(
      `
      SELECT
        u.username AS actor_username,
        f.created_at AS date
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.target_id = $1
      ORDER BY f.created_at DESC
      LIMIT 10
      `,
      [targetId]
    );

    const likesResult = await pool.query(
      `
      SELECT
        u.username AS actor_username,
        s.id AS related_story_id,
        s.story_title,
        l.created_at AS date
      FROM story_likes l
      JOIN users u ON l.user_id = u.id
      JOIN stories s ON l.story_id = s.id
      WHERE s.user_id = $1
      ORDER BY l.created_at DESC
      LIMIT 10
      `,
      [targetId]
    );

    const activity = [
      ...followersResult.rows.map(r => ({
        type: "new_follower",
        actor_username: r.actor_username,
        message: `@${r.actor_username} started following you.`,
        date: r.date
      })),
      ...likesResult.rows.map(r => ({
        type: "story_like",
        actor_username: r.actor_username,
        story_id: r.related_story_id,
        message: `@${r.actor_username} liked your story "${r.story_title}" 💖`,
        date: r.date
      }))
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20);

    res.json(activity);

  } catch (err) {
    console.error("❌ Error fetching user activity:", err);
    res.status(500).json({ error: "Failed to load activity feed." });
  }
});

/* ======================================================
   🔟 FETCH STORIES BY USER (Accepts ID or Username)
====================================================== */
router.get("/:identifier/stories", async (req, res) => {
  try {
    const { identifier } = req.params;
    const userRes = await pool.query(
      isNaN(identifier)
        ? `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`
        : `SELECT id FROM users WHERE id = $1`,
      [identifier]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userRes.rows[0].id;

    const { rows } = await pool.query(`
      SELECT s.*, 
             u.username AS author_username,
             u.display_name AS author_display_name,
             u.avatar_url AS author_avatar_url,
             COALESCE(lc.likes_count, 0) AS likes_count,
             COALESCE(cc.comments_count, 0) AS comments_count,
             COALESCE(sc.shares_count, 0) AS shares_count
      FROM stories s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN (
        SELECT story_id, COUNT(*) AS likes_count FROM story_likes GROUP BY story_id
      ) lc ON lc.story_id = s.id
      LEFT JOIN (
        SELECT story_id, COUNT(*) AS comments_count FROM story_comments GROUP BY story_id
      ) cc ON cc.story_id = s.id
      LEFT JOIN (
        SELECT story_id, COUNT(*) AS shares_count FROM shares GROUP BY story_id
      ) sc ON sc.story_id = s.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC;
    `, [userId]);

    res.json(rows);
  } catch (err) {
    console.error("❌ Fetch user stories error:", err);
    res.status(500).json({ error: "Failed to load user's stories" });
  }
});



/* ======================================================
   FETCH USER BY ID (Profile fetch by numeric ID)
====================================================== */
router.get("/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const { rows } = await pool.query(
      `
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.bio,
        u.location,
        u.relationship_status,
        u.avatar_url,
        u.gender,
        u.date_of_birth,
        u.work_education,
        u.created_at,
        (SELECT COUNT(*) FROM follows WHERE target_id = u.id) AS follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count
      FROM users u
      WHERE u.id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];
    const viewerId = req.session?.user?.id || req.session?.userId;

    user.is_own_profile = viewerId === user.id;

    user.is_following_author =
      viewerId && viewerId !== user.id
        ? (await pool.query(
            "SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2",
            [viewerId, user.id]
          )).rowCount > 0
        : false;

    user.profile_completion = calculateProfileCompletion(user);

    res.json(user);

  } catch (err) {
    console.error("❌ Error fetching user by ID:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;

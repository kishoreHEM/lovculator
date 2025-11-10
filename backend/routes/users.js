// backend/routes/users.js
import express from "express";
import pool from "../db.js";

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
   1️⃣ FETCH ALL USERS (Public Info Only)
====================================================== */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, display_name, bio, location, relationship_status,
             follower_count, following_count, avatar_url, created_at
      FROM users
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/* ======================================================
   2️⃣ FETCH SINGLE USER PROFILE (with counts)
   ✅ FIX: Use /profile/:username to prevent conflicts
====================================================== */
router.get("/profile/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const userQuery = `
      SELECT 
        u.id, u.username, u.display_name, u.bio, u.location, 
        u.relationship_status, u.avatar_url, u.created_at,
        (SELECT COUNT(*) FROM follows WHERE target_id = u.id) AS follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count,
        (SELECT COUNT(*) FROM stories WHERE user_id = u.id) AS stories_count
      FROM users u
      WHERE LOWER(u.username) = LOWER($1)
      LIMIT 1;
    `;
    const { rows } = await pool.query(userQuery, [username]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });

    const user = rows[0];

    // Check if logged-in user is following this user
    const currentUserId = req.session?.user?.id || req.session?.userId;
    if (currentUserId && currentUserId !== user.id) {
      const followCheck = await pool.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2`,
        [currentUserId, user.id]
      );
      user.is_following_author = followCheck.rowCount > 0;
    } else {
      user.is_following_author = false;
    }

    res.json(user);
  } catch (err) {
    console.error("❌ Fetch user profile error:", err);
    res.status(500).json({ error: "Failed to load user profile." });
  }
});

/* ======================================================
   3️⃣ UPDATE USER PROFILE (Requires Auth)
====================================================== */
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, bio, location, relationship_status, avatar_url } = req.body;
    const sessionUserId = req.user.id;

    if (parseInt(id) !== sessionUserId) {
      return res.status(403).json({ error: "Unauthorized action" });
    }

    const result = await pool.query(`
      UPDATE users
      SET display_name = $1, bio = $2, location = $3, relationship_status = $4, avatar_url = $5
      WHERE id = $6
      RETURNING id, username, display_name, bio, location, relationship_status,
                follower_count, following_count, avatar_url, created_at
    `, [display_name, bio, location, relationship_status, avatar_url, id]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating profile:", err);
    res.status(500).json({ error: "Profile update failed" });
  }
});

/* ======================================================
   4️⃣ FOLLOW / UNFOLLOW TOGGLE (Enhanced with Live Counts)
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

    // Check if already following
    const check = await client.query(
      "SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2",
      [followerId, targetId]
    );

    let isFollowing;

    if (check.rowCount > 0) {
      // 🩶 Unfollow
      await client.query(
        "DELETE FROM follows WHERE follower_id = $1 AND target_id = $2",
        [followerId, targetId]
      );
      isFollowing = false;
    } else {
      // ❤️ Follow
      await client.query(
        "INSERT INTO follows (follower_id, target_id, created_at) VALUES ($1, $2, NOW())",
        [followerId, targetId]
      );
      isFollowing = true;
    }

    // 🔄 Update both users' counts
    await client.query(`
      UPDATE users
      SET follower_count = (SELECT COUNT(*) FROM follows WHERE target_id = users.id),
          following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = users.id)
      WHERE id IN ($1, $2);
    `, [followerId, targetId]);

    // ✅ Get latest counts
    const { rows: targetUser } = await client.query(
      "SELECT follower_count FROM users WHERE id = $1",
      [targetId]
    );
    const { rows: followerUser } = await client.query(
      "SELECT following_count FROM users WHERE id = $1",
      [followerId]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      is_following: isFollowing,
      message: isFollowing ? "Followed successfully." : "Unfollowed successfully.",
      target_follower_count: targetUser[0]?.follower_count || 0,
      follower_following_count: followerUser[0]?.following_count || 0,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Follow/Unfollow transaction error:", err);
    res.status(500).json({ error: "Failed to toggle follow status." });
  } finally {
    client.release();
  }
});


/* ======================================================
   5️⃣ FETCH FOLLOWERS LIST
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
   6️⃣ FETCH FOLLOWING LIST
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
   7️⃣ CHECK FOLLOW STATUS
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
   8️⃣ USER ACTIVITY FEED (Followers + Likes)
====================================================== */
router.get("/:id/activity", async (req, res) => {
  const targetId = parseInt(req.params.id);

  try {
    const followersResult = await pool.query(`
      SELECT u.username AS actor_username, f.created_at AS date
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.target_id = $1
      ORDER BY f.created_at DESC LIMIT 10;
    `, [targetId]);

    const followerActivity = followersResult.rows.map(r => ({
      type: "new_follower",
      follower_username: r.actor_username, // ✅ FIXED: Changed from actor_username
      message: `@${r.actor_username} started following you.`,
      date: r.date
    }));

    const likesResult = await pool.query(`
      SELECT u.username AS actor_username, s.id AS related_story_id, s.story_title, l.created_at AS date
      FROM story_likes l
      JOIN users u ON l.user_id = u.id
      JOIN stories s ON l.story_id = s.id
      WHERE s.user_id = $1
      ORDER BY l.created_at DESC LIMIT 10;
    `, [targetId]);

    const likeActivity = likesResult.rows.map(r => ({
      type: "story_like",
      actor_username: r.actor_username,
      story_id: r.related_story_id, // ✅ FIXED: Changed from related_story_id
      message: `@${r.actor_username} liked your story "${r.story_title}" 💖`,
      date: r.date
    }));

    const combined = [...followerActivity, ...likeActivity].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.json(combined.slice(0, 20));
  } catch (err) {
    console.error("❌ Error fetching user activity:", err);
    res.status(500).json({ error: "Failed to load activity feed." });
  }
});

/* ======================================================
   9️⃣ FETCH STORIES BY USER (Accepts ID or Username)
====================================================== */
router.get("/:identifier/stories", async (req, res) => {
  try {
    const { identifier } = req.params;

    // Detect whether it's a number or a username
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



export default router;

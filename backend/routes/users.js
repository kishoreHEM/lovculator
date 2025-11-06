// backend/routes/users.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================================================
// 🔒 Middleware: Authentication Check
// ======================================================
const isAuthenticated = (req, res, next) => {
  const userId = req.session?.userId || req.session?.user?.id;
  if (userId) {
    req.user = { id: userId };
    return next();
  }
  res.status(401).json({ error: "Unauthorized: Please log in." });
};

// ======================================================
// 1️⃣ FETCH ALL USERS (Public Info Only)
// ======================================================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, email, display_name, bio, location, relationship_status,
             follower_count, following_count
      FROM users
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ======================================================
// 2️⃣ FETCH SINGLE USER BY USERNAME
// ======================================================
router.get("/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const result = await pool.query(`
      SELECT id, username, email, display_name, bio, location, relationship_status,
             follower_count, following_count
      FROM users
      WHERE username = $1
    `, [username]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Fetch user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ======================================================
// 3️⃣ UPDATE USER PROFILE (Requires Auth)
// ======================================================
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, bio, location, relationship_status } = req.body;
    const sessionUserId = req.user.id;

    if (parseInt(id) !== sessionUserId) {
      return res.status(403).json({ error: "Unauthorized action" });
    }

    const result = await pool.query(`
      UPDATE users
      SET display_name = $1, bio = $2, location = $3, relationship_status = $4
      WHERE id = $5
      RETURNING id, username, display_name, bio, location, relationship_status,
                follower_count, following_count, created_at
    `, [display_name, bio, location, relationship_status, id]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating profile:", err);
    res.status(500).json({ error: "Profile update failed" });
  }
});

// ======================================================
// 4️⃣ FOLLOW / UNFOLLOW TOGGLE
// ======================================================
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
      await client.query(
        "UPDATE users SET follower_count = follower_count - 1 WHERE id = $1",
        [targetId]
      );
      await client.query(
        "UPDATE users SET following_count = following_count - 1 WHERE id = $1",
        [followerId]
      );
      isFollowing = false;
    } else {
      await client.query(
        "INSERT INTO follows (follower_id, target_id) VALUES ($1, $2)",
        [followerId, targetId]
      );
      await client.query(
        "UPDATE users SET follower_count = follower_count + 1 WHERE id = $1",
        [targetId]
      );
      await client.query(
        "UPDATE users SET following_count = following_count + 1 WHERE id = $1",
        [followerId]
      );
      isFollowing = true;
    }

    await client.query("COMMIT");
    res.json({
      success: true,
      is_following: isFollowing,
      message: isFollowing
        ? "Followed successfully."
        : "Unfollowed successfully.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Follow/Unfollow transaction error:", err);
    res.status(500).json({ error: "Failed to toggle follow status." });
  } finally {
    client.release();
  }
});

// ======================================================
// 5️⃣ FETCH FOLLOWERS
// ======================================================
router.get("/:userId/followers", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.email
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

// ======================================================
// 6️⃣ FETCH FOLLOWING
// ======================================================
router.get("/:userId/following", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.email
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

// ======================================================
// 7️⃣ CHECK FOLLOW STATUS
// ======================================================
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

// ======================================================
// 8️⃣ GET USER ACTIVITY (Match frontend expectations)
// ======================================================
router.get("/:id/activity", async (req, res) => {
  const targetId = parseInt(req.params.id);

  try {
    // 1️⃣ New followers
    const followersResult = await pool.query(`
      SELECT 
        u.username AS actor_username,
        f.created_at AS date
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.target_id = $1
      ORDER BY f.created_at DESC
      LIMIT 10;
    `, [targetId]);

    const followerActivity = followersResult.rows.map(r => ({
      type: "new_follower",
      actor_username: r.actor_username,
      message: `@${r.actor_username} started following you.`,
      date: r.date,
      related_story_id: null
    }));

    // 2️⃣ Story likes
    const likesResult = await pool.query(`
      SELECT 
        u.username AS actor_username,
        s.id AS related_story_id,
        s.story_title,
        l.created_at AS date
      FROM likes l
      JOIN users u ON l.user_id = u.id
      JOIN stories s ON l.story_id = s.id
      WHERE s.user_id = $1
      ORDER BY l.created_at DESC
      LIMIT 10;
    `, [targetId]);

    const likeActivity = likesResult.rows.map(r => ({
      type: "story_like",
      actor_username: r.actor_username,
      message: `@${r.actor_username} liked your story "${r.story_title}" 💖`,
      date: r.date,
      related_story_id: r.related_story_id
    }));

    // Combine
    const combined = [...followerActivity, ...likeActivity].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.json(combined.slice(0, 20));
  } catch (err) {
    console.error("❌ Error fetching user activity:", err);
    res.status(500).json({ error: "Failed to load activity feed." });
  }
});



export default router;

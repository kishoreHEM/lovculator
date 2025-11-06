// backend/routes/users.js
import express from "express";
import pool from "../db.js"; // ✅ shared connection

const router = express.Router();

// ======================================================
// 1️⃣ FETCH ALL USERS (Public Info Only)
// ======================================================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, display_name, bio, location, relationship_status, 
              follower_count, following_count
       FROM users
       ORDER BY id ASC`
    );

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

    const result = await pool.query(
      `SELECT id, username, email, display_name, bio, location, relationship_status,
              follower_count, following_count
       FROM users
       WHERE username = $1`,
      [username]
    );

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
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // 🔑 Fields the user can update
    const { display_name, bio, location, relationship_status } = req.body; 
    const sessionUserId = req.session?.userId;

    // 🛑 Authorization Check
    if (!sessionUserId || parseInt(id) !== sessionUserId) {
      return res.status(403).json({ error: "Unauthorized action" });
    }

    const result = await pool.query(
      `UPDATE users 
       SET display_name = $1, bio = $2, location = $3, relationship_status = $4
       WHERE id = $5
       RETURNING id, username, display_name, bio, location, relationship_status, follower_count, following_count, created_at`, // 🔑 Return all fields needed for re-rendering the profile
      [display_name, bio, location, relationship_status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating profile:", err);
    res.status(500).json({ error: "Profile update failed" });
  }
});

// ------------------------------------------------------
// 4️⃣ FOLLOW / UNFOLLOW (Full Logic)
// ------------------------------------------------------
router.post("/:targetId/follow", async (req, res) => {
    // 🔑 req.session?.userId is the person doing the following (the follower)
    const followerId = req.session?.userId; 
    // 🔑 req.params.targetId is the person being followed/unfollowed
    const targetId = parseInt(req.params.targetId); 

    if (!followerId) {
        return res.status(401).json({ error: "Authentication required to follow." });
    }

    if (followerId === targetId) {
        return res.status(400).json({ error: "You cannot follow yourself." });
    }

    // Start a transaction for atomicity
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Check if the follow relationship already exists
        const check = await client.query(
            'SELECT * FROM follows WHERE follower_id = $1 AND target_id = $2',
            [followerId, targetId]
        );

        let isFollowing;

        if (check.rows.length > 0) {
            // Relationship exists: UNFOLLOW
            await client.query(
                'DELETE FROM follows WHERE follower_id = $1 AND target_id = $2',
                [followerId, targetId]
            );
            // Decrement target's follower_count and follower's following_count
            await client.query('UPDATE users SET follower_count = follower_count - 1 WHERE id = $1', [targetId]);
            await client.query('UPDATE users SET following_count = following_count - 1 WHERE id = $1', [followerId]);
            isFollowing = false;
        } else {
            // Relationship does not exist: FOLLOW
            await client.query(
                'INSERT INTO follows (follower_id, target_id) VALUES ($1, $2)',
                [followerId, targetId]
            );
            // Increment target's follower_count and follower's following_count
            await client.query('UPDATE users SET follower_count = follower_count + 1 WHERE id = $1', [targetId]);
            await client.query('UPDATE users SET following_count = following_count + 1 WHERE id = $1', [followerId]);
            isFollowing = true;
        }

        await client.query('COMMIT');
        // Return the new status to the frontend
        res.json({ success: true, is_following: isFollowing, message: isFollowing ? "Followed successfully." : "Unfollowed successfully." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Follow/Unfollow transaction error:", err);
        res.status(500).json({ error: "Failed to toggle follow status." });
    } finally {
        client.release();
    }
});

// Remove the old placeholder DELETE route as the POST route now handles the toggle
// router.delete("/:id/unfollow", (req, res) => { ... });

// ======================================================
// 5️⃣ FETCH USER FOLLOWERS (New Route)
// ======================================================
router.get("/:userId/followers", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Select the users who FOLLOW the userId (i.e., target_id = userId)
    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.email
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.target_id = $1
       ORDER BY u.username ASC`,
      [userId]
    );

    // Frontend expects an array of user objects
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch followers error:", err);
    res.status(500).json({ error: "Failed to fetch followers list" });
  }
});

// ======================================================
// 6️⃣ FETCH USER FOLLOWING (New Route)
// ======================================================
router.get("/:userId/following", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Select the users the userId FOLLOWS (i.e., follower_id = userId)
    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.email
       FROM follows f
       JOIN users u ON u.id = f.target_id
       WHERE f.follower_id = $1
       ORDER BY u.username ASC`,
      [userId]
    );

    // Frontend expects an array of user objects
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch following error:", err);
    res.status(500).json({ error: "Failed to fetch following list" });
  }
});

// backend/routes/users.js

// ======================================================
// 7️⃣ CHECK FOLLOW STATUS (New Route)
// ======================================================
router.get("/:targetId/is-following", async (req, res) => {
    const followerId = req.session?.userId;
    const targetId = req.params.targetId;

    if (!followerId) {
        // If not logged in, they can't be following anyone
        return res.json({ is_following: false });
    }

    try {
        const result = await pool.query(
            'SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2',
            [followerId, targetId]
        );

        // If a row is returned, the relationship exists
        const isFollowing = result.rows.length > 0;
        res.json({ is_following: isFollowing });
    } catch (err) {
        console.error("❌ Error checking follow status:", err);
        res.status(500).json({ error: "Failed to check follow status" });
    }
});
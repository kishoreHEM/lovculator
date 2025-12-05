// backend/routes/follow.js
import express from "express";
const router = express.Router();

export default function (pool) {

  // 🛡️ Protect routes
  const requireAuth = (req, res, next) => {
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: "Login required" });
    }
    next();
  };

  // ----------------------------------------------------------
  // 1️⃣ FOLLOW / UNFOLLOW USER
  // ----------------------------------------------------------
  router.post("/toggle/:id", requireAuth, async (req, res) => {
    try {
      const followerId = req.session.user.id;
      const targetId = parseInt(req.params.id);

      if (followerId === targetId) {
        return res.status(400).json({ error: "You cannot follow yourself" });
      }

      // Check if following already
      const check = await pool.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = $2`,
        [followerId, targetId]
      );

      if (check.rowCount > 0) {
        // UNFOLLOW
        await pool.query(
          `DELETE FROM follows WHERE follower_id = $1 AND target_id = $2`,
          [followerId, targetId]
        );
        return res.json({ following: false });
      }

      // FOLLOW
      await pool.query(
        `INSERT INTO follows (follower_id, target_id, created_at) VALUES ($1, $2, NOW())`,
        [followerId, targetId]
      );

      res.json({ following: true });

    } catch (err) {
      console.error("❌ Follow Error:", err.message);
      res.status(500).json({ error: "Follow action failed" });
    }
  });

  // ----------------------------------------------------------
  // 2️⃣ FOLLOWERS (Who follows ME)
  // ----------------------------------------------------------
  router.get("/followers", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user.id;

      const result = await pool.query(
        `
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.target_id = $1
        ORDER BY u.username ASC
        `,
        [userId]
      );

      res.json(result.rows);

    } catch (err) {
      console.error("❌ Followers Error:", err.message);
      res.status(500).json({ error: "Failed to load followers" });
    }
  });

  // ----------------------------------------------------------
  // 3️⃣ FOLLOWING (Who I follow)
  // ----------------------------------------------------------
  router.get("/following", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user.id;

      const result = await pool.query(
        `
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
        FROM follows f
        JOIN users u ON u.id = f.target_id
        WHERE f.follower_id = $1
        ORDER BY u.username ASC
        `,
        [userId]
      );

      res.json(result.rows);

    } catch (err) {
      console.error("❌ Following Error:", err.message);
      res.status(500).json({ error: "Failed to load following list" });
    }
  });

  // ----------------------------------------------------------
  // 4️⃣ SUGGESTIONS (Users I do NOT follow)
  // ----------------------------------------------------------
  router.get("/suggestions", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user.id;

      const result = await pool.query(
        `
        SELECT id, username, display_name, avatar_url, bio
        FROM users
        WHERE id != $1
        AND id NOT IN (
          SELECT target_id FROM follows WHERE follower_id = $1
        )
        ORDER BY RANDOM()
        LIMIT 20
        `,
        [userId]
      );

      res.json(result.rows);

    } catch (err) {
      console.error("❌ Suggestions Error:", err.message);
      res.status(500).json({ error: "Failed to load suggestions" });
    }
  });

  return router;
}

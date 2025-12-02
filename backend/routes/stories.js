import express from "express";
import pool from "../db.js";
import { notifyLike, notifyComment } from './notifications.js';

const router = express.Router();

/* -------------------------------------------
   Auth helper
------------------------------------------- */
const isAuthenticated = (req, res, next) => {
  const userId = req.session?.userId || req.session?.user?.id;
  if (userId) {
    req.user = { id: userId };
    return next();
  }
  return res
    .status(401)
    .json({ error: "Unauthorized: Please log in to perform this action." });
};

/* -------------------------------------------
   1) GET all stories (with author + follow info)
------------------------------------------- */
router.get("/", async (req, res) => {
  const filterUserId = req.query.userId;
  const category = req.query.category;
  const searchQuery = req.query.search;
  const viewerUserId = req.session?.user?.id || 0;

  const params = [viewerUserId];
  let sql = `
    SELECT
      s.id,
      s.user_id,
      s.couple_names,
      s.story_title,
      s.love_story,
      s.category,
      s.mood,
      s.together_since,
      s.anonymous_post,
      s.allow_comments,
      s.created_at,
      COALESCE(lc.likes_count, 0)    AS likes_count,
      COALESCE(cc.comments_count, 0) AS comments_count,
      COALESCE(sc.shares_count, 0)   AS shares_count,
      CASE WHEN EXISTS (
        SELECT 1 FROM story_likes l
        WHERE l.story_id = s.id AND l.user_id = $1
      ) THEN TRUE ELSE FALSE END AS user_liked,
      u.id           AS author_id,
      u.username     AS author_username,
      u.display_name AS author_display_name,
      u.avatar_url   AS author_avatar_url,
      CASE WHEN EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = $1 AND f.target_id = s.user_id
      ) THEN TRUE ELSE FALSE END AS is_following_author
    FROM stories s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN (
      SELECT story_id, COUNT(*) AS likes_count FROM story_likes GROUP BY story_id
    ) lc ON lc.story_id = s.id
    LEFT JOIN (
      SELECT story_id, COUNT(*) AS comments_count FROM story_comments GROUP BY story_id
    ) cc ON cc.story_id = s.id
    LEFT JOIN (
      SELECT story_id, COUNT(*) AS shares_count FROM shares GROUP BY story_id
    ) sc ON sc.story_id = s.id
  `;

  const where = [];
  if (filterUserId) {
    where.push(`s.user_id = $${params.length + 1}`);
    params.push(filterUserId);
  }
  if (category && category !== "all") {
    where.push(`s.category = $${params.length + 1}`);
    params.push(category);
  }
  if (searchQuery) {
    where.push(
      `(s.story_title ILIKE $${params.length + 1} OR s.love_story ILIKE $${params.length + 2})`
    );
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }

  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` ORDER BY s.created_at DESC;`;

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching stories:", err);
    res.status(500).json({ error: "Failed to fetch stories." });
  }
});

/* -------------------------------------------
   2) Create Story (auth)
------------------------------------------- */
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const {
      story_title,
      couple_names,
      love_story,
      category,
      mood,
      allowComments,
      anonymousPost,
      togetherSince,
    } = req.body;

    // ✅ Normalize and validate
    const storyTitleFinal = story_title?.trim() || "Untitled Story";
    const loveStoryFinal = love_story?.trim() || "";
    const togetherSinceFinal = togetherSince?.trim() || null;
    const allowCommentsFinal = Boolean(allowComments);
    const anonymousPostFinal = Boolean(anonymousPost);

    if (!loveStoryFinal) {
      return res
        .status(400)
        .json({ error: "Love story content cannot be empty." });
    }

    const userId = req.user.id;
    const coupleNamesFinal =
      anonymousPostFinal ? "Anonymous Couple" : couple_names?.trim() || null;

    const insertSql = `
      INSERT INTO stories
        (user_id, story_title, couple_names, love_story, category, mood,
         together_since, allow_comments, anonymous_post, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW(), NOW())
      RETURNING *;
    `;

    const { rows } = await pool.query(insertSql, [
      userId,
      storyTitleFinal,
      coupleNamesFinal,
      loveStoryFinal,
      category || null,
      mood || null,
      togetherSinceFinal,
      allowCommentsFinal,
      anonymousPostFinal,
    ]);

    console.log(`✅ New story added by user ${userId}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Error creating story:", err);
    res.status(500).json({ error: "Failed to post story." });
  }
});

/* -------------------------------------------
   3) Like / Unlike (auth) - FIXED NOTIFICATION
------------------------------------------- */
router.post("/:id/like", isAuthenticated, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const storyId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // First, get the story author ID
    const storyRes = await client.query(
      `SELECT user_id FROM stories WHERE id = $1`,
      [storyId]
    );
    
    if (storyRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Story not found." });
    }
    
    const storyAuthorId = storyRes.rows[0].user_id;

    const existing = await client.query(
      `SELECT 1 FROM story_likes WHERE user_id = $1 AND story_id = $2 FOR UPDATE`,
      [userId, storyId]
    );

    let action = "liked";
    if (existing.rowCount > 0) {
      await client.query(
        `DELETE FROM story_likes WHERE user_id = $1 AND story_id = $2`,
        [userId, storyId]
      );
      action = "unliked";
    } else {
      await client.query(
        `INSERT INTO story_likes (user_id, story_id)
         VALUES ($1, $2)
         ON CONFLICT (story_id, user_id) DO NOTHING`,
        [userId, storyId]
      );
      
      // Send notification only when liking (not unliking)
      if (storyAuthorId !== userId) {
    try {
        await notifyLike(storyAuthorId, userId, 'story', storyId);
    } catch (notifyError) {
        console.error("Failed to send notification, but continuing:", notifyError);
        // Don't fail the whole like operation if notification fails
    }
  }
}

    const countRes = await client.query(
      `SELECT COUNT(*) AS likes_count FROM story_likes WHERE story_id = $1`,
      [storyId]
    );
    await client.query("COMMIT");

    res.json({
      message: `Story ${action} successfully.`,
      likes_count: parseInt(countRes.rows[0].likes_count, 10),
      is_liked: action === "liked",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Like toggle error:", err);
    res.status(500).json({ error: "Failed to toggle like on story." });
  } finally {
    client.release();
  }
});

/* -------------------------------------------
   4) Add Comment (auth) - FIXED NOTIFICATION
------------------------------------------- */
router.post("/:storyId/comments", isAuthenticated, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const storyId = parseInt(req.params.storyId, 10);
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || !text.trim())
      return res.status(400).json({ error: "Comment text cannot be empty." });

    // First, get the story and its author
    const storyRes = await client.query(
      `SELECT id, user_id FROM stories WHERE id = $1`,
      [storyId]
    );
    if (storyRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Story not found." });
    }
    
    const storyAuthorId = storyRes.rows[0].user_id;

    const commentRes = await client.query(
      `INSERT INTO story_comments (story_id, user_id, comment_text, created_at)
       VALUES ($1,$2,$3,NOW())
       RETURNING id, story_id, user_id, comment_text, created_at`,
      [storyId, userId, text.trim()]
    );

    // Send notification only if commenter is not the story author
    if (storyAuthorId !== userId) {
    try {
        await notifyComment(storyAuthorId, userId, 'story', storyId);
    } catch (notifyError) {
        console.error("Failed to send notification, but continuing:", notifyError);
        // Don't fail the whole comment operation if notification fails
    }
}

    const updateRes = await client.query(
      `UPDATE stories
         SET comments_count = COALESCE(comments_count,0) + 1,
             updated_at = NOW()
       WHERE id = $1
       RETURNING comments_count`,
      [storyId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Comment posted successfully.",
      comment: commentRes.rows[0],
      comments_count: updateRes.rows[0].comments_count,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Comment error:", err);
    res.status(500).json({ error: "Failed to post comment." });
  } finally {
    client.release();
  }
});

/* -------------------------------------------
   5) Fetch Comments (with author avatar)
------------------------------------------- */
router.get("/:storyId/comments", async (req, res) => {
  try {
    const storyId = req.params.storyId;
    const { rows } = await pool.query(
      `SELECT
         c.id,
         c.comment_text,
         c.created_at,
         c.user_id,
         COALESCE(u.username, 'Anonymous')  AS author_name,
         u.avatar_url                        AS author_avatar_url
       FROM story_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.story_id = $1
       ORDER BY c.created_at ASC`,
      [storyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Fetch comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments." });
  }
});

/* -------------------------------------------
   6) Share Tracking
------------------------------------------- */
router.post("/:storyId/share", async (req, res) => {
  try {
    const storyId = req.params.storyId;
    const anonId = req.headers["x-anon-id"];
    const userId = req.session?.user?.id || null;

    await pool.query(
      `INSERT INTO shares (story_id, user_id, anon_id)
       VALUES ($1,$2,$3)`,
      [storyId, userId, anonId]
    );

    const { rows } = await pool.query(
      `SELECT COUNT(*) AS shares_count FROM shares WHERE story_id = $1`,
      [storyId]
    );

    res.json({
      message: "Share tracked successfully.",
      shares_count: parseInt(rows[0].shares_count, 10),
    });
  } catch (err) {
    console.error("❌ Share tracking error:", err);
    res.status(500).json({ error: "Failed to track share." });
  }
});

/* -------------------------------------------
   7) Delete Story (auth & ownership)
------------------------------------------- */
router.delete("/:storyId", isAuthenticated, async (req, res) => {
  const storyId = parseInt(req.params.storyId, 10);
  const userId = req.user.id;

  if (isNaN(storyId)) {
    return res.status(400).json({ error: "Invalid story ID." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM stories WHERE id = $1`,
      [storyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Story not found." });
    }

    if (rows[0].user_id !== userId) {
      return res
        .status(403)
        .json({ error: "Forbidden: You can only delete your own stories." });
    }

    await pool.query(`DELETE FROM stories WHERE id = $1`, [storyId]);

    console.log(`💀 Story ${storyId} deleted by user ${userId}`);
    res.status(200).json({ message: "Story deleted successfully." });
  } catch (err) {
    console.error("❌ Delete story error:", err);
    res.status(500).json({ error: "Failed to delete story." });
  }
});

/* -------------------------------------------
   8) Report Story (auth required)
------------------------------------------- */
router.post("/:storyId/report", isAuthenticated, async (req, res) => {
  const storyId = parseInt(req.params.storyId, 10);
  const { reason, description } = req.body;
  const reporterId = req.user.id;

  if (isNaN(storyId)) {
    return res.status(400).json({ error: "Invalid story ID." });
  }

  if (!reason || reason.trim().length < 3) {
    return res
      .status(400)
      .json({ error: "Please provide a valid reason for reporting." });
  }

  try {
    const storyCheck = await pool.query(`SELECT id FROM stories WHERE id = $1`, [
      storyId,
    ]);
    if (storyCheck.rowCount === 0) {
      return res.status(404).json({ error: "Story not found." });
    }

    await pool.query(
      `INSERT INTO story_reports (story_id, reporter_id, reason, description, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [storyId, reporterId, reason.trim(), description?.trim() || null]
    );

    console.log(`🚨 Story ${storyId} reported by user ${reporterId}`);

    res.status(201).json({
      message:
        "Story reported successfully. Our moderation team will review it shortly.",
    });
  } catch (err) {
    console.error("❌ Report story error:", err);
    res.status(500).json({ error: "Failed to submit report." });
  }
});

export default router;
// ============================================================
// 💬 Lovculator Unified Q&A API (Enhanced Version)
// ============================================================

import express from "express";
const router = express.Router();

export default (pool) => {
  // ======================================================
  // 🧩 Helper — Create SEO-friendly Slug
  // ======================================================
  const createSlug = (text) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 180);
  };

  // ======================================================
  // 🛡️ Middleware — Check Authentication
  // ======================================================
  const requireAuth = (req, res, next) => {
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };

  // ======================================================
  // 1️⃣ POST /api/questions — Add new question
  // ======================================================
  router.post("/", requireAuth, async (req, res) => {
    try {
      const { question, description, tags } = req.body;
      const userId = req.session.user.id;

      if (!question || question.trim().length < 5) {
        return res.status(400).json({
          error: "Question must be at least 5 characters long.",
        });
      }

      // Generate base slug
      let slug = createSlug(question);
      const checkSlug = await pool.query(
        "SELECT slug FROM questions WHERE slug = $1",
        [slug]
      );

      // If duplicate, append unique timestamp
      if (checkSlug.rows.length > 0) {
        slug = `${slug}-${Date.now().toString().slice(-5)}`;
      }

      const insertRes = await pool.query(
        `
        INSERT INTO questions (user_id, question, description, slug, tags, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, question, description, slug, tags, created_at;
        `,
        [userId, question.trim(), description || null, slug, tags || []]
      );

      const newQuestion = insertRes.rows[0];
      console.log(`✅ Question Added: ${newQuestion.slug}`);

      res.json({
        success: true,
        message: "Question added successfully.",
        question: newQuestion,
        share_url: `https://lovculator.com/questions/${newQuestion.slug}`,
      });
    } catch (err) {
      console.error("❌ Error adding question:", err.message);
      res.status(500).json({ error: "Failed to add question." });
    }
  });

  // ======================================================
  // 2️⃣ GET /api/questions/latest — Fetch recent questions
  // ======================================================
  router.get("/latest", async (req, res) => {
    try {
      const userId = req.session?.user?.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const questionsRes = await pool.query(
        `
        SELECT 
          q.id, 
          q.question, 
          q.slug, 
          q.description,
          q.tags,
          q.created_at,
          u.username,
          u.display_name,
          u.profile_image_url,
          COUNT(DISTINCT a.id) as answers_count,
          COUNT(DISTINCT l.id) as likes_count,
          EXISTS(SELECT 1 FROM question_likes WHERE question_id = q.id AND user_id = $1) as user_liked
        FROM questions q
        LEFT JOIN users u ON q.user_id = u.id
        LEFT JOIN answers a ON q.id = a.question_id
        LEFT JOIN question_likes l ON q.id = l.question_id
        GROUP BY q.id, u.id
        ORDER BY q.created_at DESC
        LIMIT $2 OFFSET $3;
        `,
        [userId, limit, offset]
      );

      res.json(questionsRes.rows);
    } catch (err) {
      console.error("❌ Error fetching latest questions:", err.message);
      res.status(500).json({ error: "Failed to load questions." });
    }
  });

  // ======================================================
  // 3️⃣ GET /api/questions/:slug — Fetch single question
  // ======================================================
  router.get("/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const userId = req.session?.user?.id;
      let questionRes;

      // Support both numeric ID and slug URLs
      if (/^\d+$/.test(slug)) {
        questionRes = await pool.query(
          `
          SELECT 
            q.*,
            u.username,
            u.display_name,
            u.profile_image_url as avatar_url,
            u.bio,
            COUNT(DISTINCT a.id) as answers_count,
            COUNT(DISTINCT l.id) as likes_count,
            COUNT(DISTINCT v.id) as views_count,
            EXISTS(SELECT 1 FROM question_likes WHERE question_id = q.id AND user_id = $1) as user_liked
          FROM questions q
          LEFT JOIN users u ON q.user_id = u.id
          LEFT JOIN answers a ON q.id = a.question_id
          LEFT JOIN question_likes l ON q.id = l.question_id
          LEFT JOIN question_views v ON q.id = v.question_id
          WHERE q.id = $2
          GROUP BY q.id, u.id
          `,
          [userId, slug]
        );
      } else {
        questionRes = await pool.query(
          `
          SELECT 
            q.*,
            u.username,
            u.display_name,
            u.profile_image_url as avatar_url,
            u.bio,
            COUNT(DISTINCT a.id) as answers_count,
            COUNT(DISTINCT l.id) as likes_count,
            COUNT(DISTINCT v.id) as views_count,
            EXISTS(SELECT 1 FROM question_likes WHERE question_id = q.id AND user_id = $1) as user_liked
          FROM questions q
          LEFT JOIN users u ON q.user_id = u.id
          LEFT JOIN answers a ON q.id = a.question_id
          LEFT JOIN question_likes l ON q.id = l.question_id
          LEFT JOIN question_views v ON q.id = v.question_id
          WHERE q.slug = $2
          GROUP BY q.id, u.id
          `,
          [userId, slug]
        );
      }

      if (questionRes.rows.length === 0) {
        return res.status(404).json({ error: "Question not found" });
      }

      const question = questionRes.rows[0];

      // Track view
      if (userId) {
        await pool.query(
          `
          INSERT INTO question_views (question_id, user_id, viewed_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (question_id, user_id) DO UPDATE SET viewed_at = NOW();
          `,
          [question.id, userId]
        );
      }

      // Fetch answers with user info
      const answersRes = await pool.query(
        `
        SELECT 
          a.id,
          a.answer_text as answer,
          a.created_at,
          u.id as user_id,
          u.username,
          u.display_name,
          u.profile_image_url as avatar_url,
          u.bio,
          COUNT(DISTINCT al.id) as likes_count,
          COUNT(DISTINCT ac.id) as comments_count,
          EXISTS(SELECT 1 FROM answer_likes WHERE answer_id = a.id AND user_id = $1) as user_liked
        FROM answers a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN answer_likes al ON a.id = al.answer_id
        LEFT JOIN answer_comments ac ON a.id = ac.answer_id
        WHERE a.question_id = $2
        GROUP BY a.id, u.id
        ORDER BY a.created_at ASC;
        `,
        [userId, question.id]
      );

      res.json({
        ...question,
        answers: answersRes.rows,
      });
    } catch (err) {
      console.error("❌ Error fetching question:", err.message);
      res.status(500).json({ error: "Failed to load question." });
    }
  });

  // ======================================================
  // 4️⃣ POST /api/questions/:id/answer — Add Answer
  // ======================================================
  router.post("/:id/answer", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { answer, anonymous = false } = req.body;
      const userId = req.session.user.id;

      if (!answer || answer.trim().length === 0) {
        return res.status(400).json({ error: "Answer cannot be empty." });
      }

      if (answer.trim().length < 10) {
        return res.status(400).json({ 
          error: "Answer must be at least 10 characters long." 
        });
      }

      // Check if user already answered
      const existingAnswer = await pool.query(
        "SELECT id FROM answers WHERE question_id = $1 AND user_id = $2",
        [id, userId]
      );

      if (existingAnswer.rows.length > 0) {
        return res.status(400).json({ 
          error: "You have already answered this question." 
        });
      }

      const result = await pool.query(
        `
        INSERT INTO answers (question_id, user_id, answer_text, is_anonymous, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, answer_text, created_at;
        `,
        [id, userId, answer.trim(), anonymous]
      );

      console.log(`💬 New answer added to question ID ${id}`);
      res.json({ 
        success: true, 
        message: "Answer posted successfully.",
        answer: result.rows[0]
      });
    } catch (err) {
      console.error("❌ Error posting answer:", err.message);
      res.status(500).json({ error: "Failed to post answer." });
    }
  });

  // ======================================================
  // 5️⃣ GET /api/questions/for-you — Questions for current user
  // ======================================================
  router.get("/for-you", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user.id;
      
      // Get questions from users the current user follows
      const questionsRes = await pool.query(
        `
        SELECT DISTINCT
          q.id, 
          q.question, 
          q.slug, 
          q.description,
          q.tags,
          q.created_at,
          u.username,
          u.display_name,
          u.profile_image_url,
          COUNT(DISTINCT a.id) as answers_count,
          COUNT(DISTINCT l.id) as likes_count,
          false as user_liked
        FROM questions q
        LEFT JOIN users u ON q.user_id = u.id
        LEFT JOIN answers a ON q.id = a.question_id
        LEFT JOIN question_likes l ON q.id = l.question_id
        WHERE u.id IN (
          SELECT following_id FROM user_follows WHERE follower_id = $1
        )
        OR q.user_id = $1
        GROUP BY q.id, u.id
        ORDER BY q.created_at DESC
        LIMIT 20;
        `,
        [userId]
      );

      res.json(questionsRes.rows);
    } catch (err) {
      console.error("❌ Error fetching questions for you:", err.message);
      res.status(500).json({ error: "Failed to load questions." });
    }
  });

  // ======================================================
  // 6️⃣ GET /api/questions/my — User's questions
  // ======================================================
  router.get("/my/questions", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user.id;
      
      const questionsRes = await pool.query(
        `
        SELECT 
          q.id, 
          q.question, 
          q.slug, 
          q.description,
          q.tags,
          q.created_at,
          COUNT(DISTINCT a.id) as answers_count,
          COUNT(DISTINCT l.id) as likes_count,
          COUNT(DISTINCT v.id) as views_count
        FROM questions q
        LEFT JOIN answers a ON q.id = a.question_id
        LEFT JOIN question_likes l ON q.id = l.question_id
        LEFT JOIN question_views v ON q.id = v.question_id
        WHERE q.user_id = $1
        GROUP BY q.id
        ORDER BY q.created_at DESC;
        `,
        [userId]
      );

      res.json(questionsRes.rows);
    } catch (err) {
      console.error("❌ Error fetching user's questions:", err.message);
      res.status(500).json({ error: "Failed to load questions." });
    }
  });

  // ======================================================
  // 7️⃣ GET /api/questions/my/answers — User's answers
  // ======================================================
  router.get("/my/answers", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user.id;
      
      const answersRes = await pool.query(
        `
        SELECT 
          a.id,
          a.answer_text as answer,
          a.created_at,
          a.is_anonymous,
          q.id as question_id,
          q.question,
          q.slug,
          COUNT(DISTINCT al.id) as likes_count,
          COUNT(DISTINCT ac.id) as comments_count
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        LEFT JOIN answer_likes al ON a.id = al.answer_id
        LEFT JOIN answer_comments ac ON a.id = ac.answer_id
        WHERE a.user_id = $1
        GROUP BY a.id, q.id
        ORDER BY a.created_at DESC;
        `,
        [userId]
      );

      res.json(answersRes.rows);
    } catch (err) {
      console.error("❌ Error fetching user's answers:", err.message);
      res.status(500).json({ error: "Failed to load answers." });
    }
  });

  // ======================================================
  // 8️⃣ POST /api/questions/:id/like — Like a question
  // ======================================================
  router.post("/:id/like", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;

      // Check if already liked
      const existingLike = await pool.query(
        "SELECT id FROM question_likes WHERE question_id = $1 AND user_id = $2",
        [id, userId]
      );

      if (existingLike.rows.length > 0) {
        // Unlike
        await pool.query(
          "DELETE FROM question_likes WHERE question_id = $1 AND user_id = $2",
          [id, userId]
        );
        
        const likeCountRes = await pool.query(
          "SELECT COUNT(*) as count FROM question_likes WHERE question_id = $1",
          [id]
        );
        
        res.json({ 
          is_liked: false, 
          like_count: parseInt(likeCountRes.rows[0].count) 
        });
      } else {
        // Like
        await pool.query(
          "INSERT INTO question_likes (question_id, user_id, liked_at) VALUES ($1, $2, NOW())",
          [id, userId]
        );
        
        const likeCountRes = await pool.query(
          "SELECT COUNT(*) as count FROM question_likes WHERE question_id = $1",
          [id]
        );
        
        res.json({ 
          is_liked: true, 
          like_count: parseInt(likeCountRes.rows[0].count) 
        });
      }
    } catch (err) {
      console.error("❌ Error liking question:", err.message);
      res.status(500).json({ error: "Failed to like question." });
    }
  });

  // ======================================================
  // 9️⃣ POST /api/answers/:id/like — Like an answer
  // ======================================================
  router.post("/answers/:id/like", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;

      // Check if already liked
      const existingLike = await pool.query(
        "SELECT id FROM answer_likes WHERE answer_id = $1 AND user_id = $2",
        [id, userId]
      );

      if (existingLike.rows.length > 0) {
        // Unlike
        await pool.query(
          "DELETE FROM answer_likes WHERE answer_id = $1 AND user_id = $2",
          [id, userId]
        );
        
        const likeCountRes = await pool.query(
          "SELECT COUNT(*) as count FROM answer_likes WHERE answer_id = $1",
          [id]
        );
        
        res.json({ 
          is_liked: false, 
          like_count: parseInt(likeCountRes.rows[0].count) 
        });
      } else {
        // Like
        await pool.query(
          "INSERT INTO answer_likes (answer_id, user_id, liked_at) VALUES ($1, $2, NOW())",
          [id, userId]
        );
        
        const likeCountRes = await pool.query(
          "SELECT COUNT(*) as count FROM answer_likes WHERE answer_id = $1",
          [id]
        );
        
        res.json({ 
          is_liked: true, 
          like_count: parseInt(likeCountRes.rows[0].count) 
        });
      }
    } catch (err) {
      console.error("❌ Error liking answer:", err.message);
      res.status(500).json({ error: "Failed to like answer." });
    }
  });

  // ======================================================
  // 🔟 DELETE /api/questions/:id — Delete question
  // ======================================================
  router.delete("/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.user.id;

      // Check ownership
      const questionRes = await pool.query(
        "SELECT user_id FROM questions WHERE id = $1",
        [id]
      );

      if (questionRes.rows.length === 0) {
        return res.status(404).json({ error: "Question not found" });
      }

      if (questionRes.rows[0].user_id !== userId) {
        return res.status(403).json({ error: "Not authorized to delete this question" });
      }

      await pool.query("DELETE FROM questions WHERE id = $1", [id]);
      
      res.json({ success: true, message: "Question deleted successfully." });
    } catch (err) {
      console.error("❌ Error deleting question:", err.message);
      res.status(500).json({ error: "Failed to delete question." });
    }
  });

  return router;
};
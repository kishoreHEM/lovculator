// ============================================================
// 💬 Lovculator Unified Q&A API (Final SEO + Performance Build)
// Author: Kishore M
// Date: 2025-11-11
// Description:
//   - Handles question posting from homepage modal
//   - Generates SEO-friendly slugs automatically
//   - Supports /:slug and /:id fetching
//   - Limits answers per question to 5
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
      .replace(/[^\w\s-]/g, "") // remove special characters
      .trim()
      .replace(/\s+/g, "-") // replace spaces with hyphens
      .replace(/-+/g, "-") // remove duplicate hyphens
      .substring(0, 180); // ensure it's within 180 chars
  };

  // ======================================================
  // 1️⃣ POST /api/questions — Add new question with slug
  // ======================================================
  router.post("/", async (req, res) => {
    try {
      const { question } = req.body;
      const userId = req.session?.user?.id || null;

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
        INSERT INTO questions (user_id, question, slug, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id, question, slug, created_at;
        `,
        [userId, question.trim(), slug]
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
      const questionsRes = await pool.query(`
        SELECT q.id, q.question, q.slug, q.created_at
        FROM questions q
        ORDER BY q.created_at DESC
        LIMIT 20;
      `);

      // Fetch top 5 answers for each question
      const enriched = await Promise.all(
        questionsRes.rows.map(async (q) => {
          const answers = await pool.query(
            `
            SELECT id, answer_text AS answer, created_at
            FROM answers
            WHERE question_id = $1
            ORDER BY created_at ASC
            LIMIT 5;
            `,
            [q.id]
          );
          return { ...q, answers: answers.rows };
        })
      );

      res.json(enriched);
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
      let questionRes;

      // Support both numeric ID and slug URLs
      if (/^\d+$/.test(slug)) {
        questionRes = await pool.query("SELECT * FROM questions WHERE id = $1", [
          slug,
        ]);
      } else {
        questionRes = await pool.query("SELECT * FROM questions WHERE slug = $1", [
          slug,
        ]);
      }

      if (questionRes.rows.length === 0) {
        return res.status(404).json({ error: "Question not found" });
      }

      const question = questionRes.rows[0];

      const answersRes = await pool.query(
        `
        SELECT id, answer_text AS answer, created_at
        FROM answers
        WHERE question_id = $1
        ORDER BY created_at ASC
        LIMIT 5;
        `,
        [question.id]
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
  // 4️⃣ POST /api/questions/:id/answer — Add Answer (Max 5)
  // ======================================================
  router.post("/:id/answer", async (req, res) => {
    try {
      const { id } = req.params;
      const { answer } = req.body;
      const userId = req.session?.user?.id || null;

      if (!answer || answer.trim().length === 0) {
        return res.status(400).json({ error: "Answer cannot be empty." });
      }

      // Check answer count
      const countRes = await pool.query(
        "SELECT COUNT(*) FROM answers WHERE question_id = $1;",
        [id]
      );
      const count = parseInt(countRes.rows[0].count);

      if (count >= 5) {
        return res
          .status(400)
          .json({ message: "Already answered by 5 users." });
      }

      await pool.query(
        `
        INSERT INTO answers (question_id, user_id, answer_text, created_at)
        VALUES ($1, $2, $3, NOW());
        `,
        [id, userId, answer.trim()]
      );

      console.log(`💬 New answer added to question ID ${id}`);
      res.json({ success: true, message: "Answer posted successfully." });
    } catch (err) {
      console.error("❌ Error posting answer:", err.message);
      res.status(500).json({ error: "Failed to post answer." });
    }
  });

  // ======================================================
  // 5️⃣ DELETE /api/questions/cleanup — Maintenance
  // ======================================================
  router.delete("/cleanup", async (req, res) => {
    try {
      await pool.query(`
        DELETE FROM questions
        WHERE id IN (
          SELECT id FROM questions
          ORDER BY created_at ASC
          OFFSET 500
        );
      `);
      res.json({ success: true, message: "Old questions cleaned up." });
    } catch (err) {
      console.error("⚠️ Cleanup error:", err.message);
      res.status(500).json({ error: "Cleanup failed." });
    }
  });

  return router;
};

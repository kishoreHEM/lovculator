// backend/routes/questions.js
import express from "express";
const router = express.Router();

export default (pool) => {
  // 📝 Post a new question (Login required)
router.post("/", async (req, res) => {
  try {
    const { question } = req.body;
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Please login to post a question." });
    }

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: "Question cannot be empty." });
    }

    const result = await pool.query(
      `INSERT INTO questions (user_id, question, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, question AS question, created_at`,
      [userId, question.trim()]
    );

    res.status(201).json({
      message: "Question added successfully!",
      question: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error adding question:", err.message);
    res.status(500).json({ error: "Failed to add question", details: err.message });
  }
});


  // 🧠 Fetch all questions
  router.get("/", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT q.id, q.question, q.created_at,
               COUNT(a.id) AS answer_count
        FROM questions q
        LEFT JOIN answers a ON q.id = a.question_id
        GROUP BY q.id
        ORDER BY q.created_at DESC;
      `);

      res.json(result.rows);
    } catch (err) {
      console.error("❌ Error fetching questions:", err);
      res.status(500).json({ error: "Failed to load questions" });
    }
  });

  // ❤️ Like a question
  router.post("/:id/like", async (req, res) => {
    try {
      const id = req.params.id;
      await pool.query(
        "UPDATE questions SET likes = COALESCE(likes,0) + 1 WHERE id = $1",
        [id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Like error:", err);
      res.status(500).json({ error: "Failed to like question" });
    }
  });

  // 💬 Post an answer
  router.post("/:id/answer", async (req, res) => {
    try {
      const { answer } = req.body;
      const id = req.params.id;
      if (!answer) return res.status(400).json({ error: "Answer required" });
      await pool.query(
        "INSERT INTO answers (question_id, answer_text) VALUES ($1, $2)",
        [id, answer]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Answer error:", err);
      res.status(500).json({ error: "Failed to post answer" });
    }
  });

  return router;
};

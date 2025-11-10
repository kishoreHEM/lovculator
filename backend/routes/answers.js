import express from "express";
const router = express.Router();

export default (pool) => {
  // 🧠 Get all answers for a specific question
  router.get("/:questionId", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, question_id, answer, created_at FROM answers WHERE question_id = $1 ORDER BY created_at DESC",
        [req.params.questionId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching answers:", err);
      res.status(500).json({ error: "Failed to fetch answers" });
    }
  });

  // 📝 Post a new answer
  router.post("/", async (req, res) => {
    const { question_id, answer } = req.body;
    if (!question_id || !answer?.trim()) {
      return res.status(400).json({ error: "Invalid input" });
    }

    try {
      const result = await pool.query(
        "INSERT INTO answers (question_id, answer, created_at) VALUES ($1, $2, NOW()) RETURNING *",
        [question_id, answer.trim()]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error posting answer:", err);
      res.status(500).json({ error: "Failed to post answer" });
    }
  });

  // ✏️ Edit an existing answer
  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { answer } = req.body;
    if (!answer?.trim()) return res.status(400).json({ error: "Answer cannot be empty" });

    try {
      const result = await pool.query(
        "UPDATE answers SET answer = $1 WHERE id = $2 RETURNING *",
        [answer.trim(), id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Answer not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error editing answer:", err);
      res.status(500).json({ error: "Failed to update answer" });
    }
  });

  // ❌ Delete an answer
  router.delete("/:id", async (req, res) => {
    try {
      const result = await pool.query("DELETE FROM answers WHERE id = $1 RETURNING id", [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ error: "Answer not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting answer:", err);
      res.status(500).json({ error: "Failed to delete answer" });
    }
  });

  return router;
};

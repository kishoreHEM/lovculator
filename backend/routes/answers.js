// backend/routes/answers.js
import express from "express";
const router = express.Router();

export default (pool) => {
  // 🧠 Get all answers for a specific question
  router.get("/:question_id", async (req, res) => {
    const { question_id } = req.params;
    try {
      const result = await pool.query(
        "SELECT id, answer_text AS answer, created_at FROM answers WHERE question_id = $1 ORDER BY created_at DESC",
        [question_id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("❌ Error fetching answers:", err.message);
      res.status(500).json({ error: "Failed to load answers" });
    }
  });

  // 💬 Post new answer
  router.post("/:question_id", async (req, res) => {
    const { question_id } = req.params;
    const { answer } = req.body;
    try {
      await pool.query(
        "INSERT INTO answers (question_id, answer_text, created_at) VALUES ($1, $2, NOW())",
        [question_id, answer]
      );
      res.status(201).json({ message: "Answer posted successfully" });
    } catch (err) {
      console.error("❌ Error posting answer:", err.message);
      res.status(500).json({ error: "Failed to post answer" });
    }
  });

  // ✏️ Edit an answer
  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { answer } = req.body;
    try {
      await pool.query("UPDATE answers SET answer_text = $1 WHERE id = $2", [answer, id]);
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error updating answer:", err.message);
      res.status(500).json({ error: "Failed to update answer" });
    }
  });

  // 🗑️ Delete an answer
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM answers WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("❌ Error deleting answer:", err.message);
      res.status(500).json({ error: "Failed to delete answer" });
    }
  });

  return router;
};

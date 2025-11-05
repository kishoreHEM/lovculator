// backend/routes/analytics.js
import express from "express";
const router = express.Router();

export default (pool) => {
  // 📊 Get total visits per page
  router.get("/stats", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT path, COUNT(*) AS total_visits
         FROM page_visits
         GROUP BY path
         ORDER BY total_visits DESC`
      );
      res.json(result.rows);
    } catch (err) {
      console.error("⚠️ Analytics fetch error:", err.message);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // 🕒 Get latest 10 visits
  router.get("/recent", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT path, ip_address, user_agent, visit_time
         FROM page_visits
         ORDER BY visit_time DESC
         LIMIT 10`
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch recent visits" });
    }
  });

  return router;
};

// backend/routes/analytics.js
import express from "express";

const router = express.Router();

export default (pool) => {
  /**
   * ==============================================================
   * 1️⃣  Most Visited Pages (Top 10)
   * Endpoint: GET /api/analytics/stats
   * ==============================================================
   */
  router.get("/stats", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT path, COUNT(*) AS total_visits
        FROM page_visits
        GROUP BY path
        ORDER BY total_visits DESC
        LIMIT 10
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("⚠️ Analytics /stats error:", err.message);
      res.status(500).json({ error: "Failed to fetch analytics stats" });
    }
  });

  /**
   * ==============================================================
   * 2️⃣  Recent Visits (Latest 10)
   * Endpoint: GET /api/analytics/recent
   * ==============================================================
   */
  router.get("/recent", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT path, ip_address, user_agent, visit_time
        FROM page_visits
        ORDER BY visit_time DESC
        LIMIT 10
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("⚠️ Analytics /recent error:", err.message);
      res.status(500).json({ error: "Failed to fetch recent visits" });
    }
  });

  /**
   * ==============================================================
   * 3️⃣  Daily Visit Trends (Last 14 days)
   * Endpoint: GET /api/analytics/daily
   * ==============================================================
   */
  router.get("/daily", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          DATE(visit_time) AS visit_date,
          COUNT(*) AS visits
        FROM page_visits
        WHERE visit_time > NOW() - INTERVAL '14 days'
        GROUP BY visit_date
        ORDER BY visit_date ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("⚠️ Analytics /daily error:", err.message);
      res.status(500).json({ error: "Failed to fetch daily visits" });
    }
  });

  /**
   * ==============================================================
   * 4️⃣  Health Check (optional)
   * Quick endpoint to verify DB connection
   * Endpoint: GET /api/analytics/health
   * ==============================================================
   */
  router.get("/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(500).json({ status: "db_error" });
    }
  });

  return router;
};

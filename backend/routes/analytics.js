// backend/routes/analytics.js
import express from "express";
import { checkAdmin } from "../middleware/checkAdmin.js";

const router = express.Router();

export default (pool) => {
  /**
   * ==============================================================
   * 1️⃣  Most Visited Pages (Top 10)
   * Endpoint: GET /api/analytics/stats
   * ==============================================================
   */
  // 📊 Get total visits per page (Admin only)
  router.get("/stats", checkAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT path, COUNT(*) AS total_visits
        FROM page_visits
        GROUP BY path
        ORDER BY total_visits DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("⚠️ Analytics fetch error:", err.message);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  /**
   * ==============================================================
   * 2️⃣  Recent Visits (Latest 10)
   * Endpoint: GET /api/analytics/recent
   * ==============================================================
   */
  // 🕒 Get latest 10 visits (Admin only)
  router.get("/recent", checkAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT pv.path, pv.ip_address, pv.user_agent, pv.visit_time, u.username
        FROM page_visits pv
        LEFT JOIN users u ON pv.user_id = u.id
        ORDER BY pv.visit_time DESC
        LIMIT 10
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("⚠️ Recent visits fetch error:", err.message);
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

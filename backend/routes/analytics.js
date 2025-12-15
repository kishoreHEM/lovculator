import express from "express";
import { checkAdmin } from "../middleware/checkAdmin.js";

const router = express.Router();

export default (pool) => {
  // 1️⃣ Most Visited Pages
  router.get("/stats", checkAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT path, COUNT(*)::int AS total_visits
        FROM page_visits
        GROUP BY path
        ORDER BY total_visits DESC
        LIMIT 20
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("Stats error:", err.message);
      res.json([]); // Return empty array instead of crashing
    }
  });

  // 2️⃣ Recent Visits
  router.get("/recent", checkAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT pv.path, pv.visit_time, u.username
        FROM page_visits pv
        LEFT JOIN users u ON pv.user_id = u.id
        ORDER BY pv.visit_time DESC
        LIMIT 10
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("Recent error:", err.message);
      res.json([]); 
    }
  });

  // 3️⃣ Daily Trends (Fixed SQL Syntax)
  router.get("/daily", checkAdmin, async (req, res) => {
    try {
      // ✅ FIX: Using GROUP BY 1 (positional) is safer for aliases in Postgres
      // ✅ FIX: Extended interval to 60 days so you can see your old data
      const result = await pool.query(`
        SELECT TO_CHAR(visit_time, 'YYYY-MM-DD') AS visit_date, COUNT(*)::int AS visits
        FROM page_visits
        WHERE visit_time >= NOW() - INTERVAL '60 days' 
        GROUP BY 1
        ORDER BY 1 ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("Daily error:", err.message);
      res.json([]); 
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

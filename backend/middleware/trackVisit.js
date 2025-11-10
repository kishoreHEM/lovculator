// backend/middleware/trackVisit.js
import pool from "../db.js";

/**
 * Middleware: Track every frontend page visit with optional logged-in user info.
 */
export async function trackPageVisit(req, res, next) {
  try {
    // Skip API endpoints (we only log frontend visits)
    if (req.path.startsWith("/api")) return next();

    // Get visitor details
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] || "unknown";
    const path = req.originalUrl;

    // ✅ Detect logged-in user (based on session)
    const userId = req.session?.user?.id || req.session?.userId || null;

    // Save to database
    await pool.query(
      `INSERT INTO page_visits (path, ip_address, user_agent, user_id)
       VALUES ($1, $2, $3, $4)`,
      [path, ip, userAgent, userId]
    );

  } catch (err) {
    console.error("⚠️ Error tracking page visit:", err.message);
  }

  next(); // continue request flow
}

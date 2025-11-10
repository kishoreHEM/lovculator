// backend/middleware/trackVisit.js
import pool from "../db.js";

export async function trackPageVisit(req, res, next) {
  try {
    // Skip API requests (we only log frontend pages)
    if (req.path.startsWith("/api")) return next();

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] || "unknown";
    const path = req.originalUrl;

    await pool.query(
      "INSERT INTO page_visits (path, ip_address, user_agent) VALUES ($1, $2, $3)",
      [path, ip, userAgent]
    );
  } catch (err) {
    console.error("⚠️ Error tracking page visit:", err.message);
  }

  next(); // Continue to the next middleware or route
}

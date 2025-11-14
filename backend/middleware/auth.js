// backend/middleware/auth.js
// 🔒 Authentication middleware for Lovculator.com

export default function auth(req, res, next) {
  try {
    // Your session system stores user in either:
    //    req.session.user  (object with {id,...})
    //    req.session.userId (plain integer)
    const sessionUser = req.session?.user || null;
    const sessionId = req.session?.userId || null;

    // Determine final user ID
    const userId = sessionUser?.id ?? sessionId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    // Attach to req.user for downstream routes
    req.user = {
      id: userId,
      username: sessionUser?.username,
      display_name: sessionUser?.display_name,
    };

    return next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err);
    return res.status(500).json({ error: "Authentication failed internally." });
  }
}

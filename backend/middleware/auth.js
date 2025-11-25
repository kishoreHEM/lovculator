// backend/middleware/auth.js

export default function auth(req, res, next) {
  try {
    const userSession = req.session?.user;
    const userId = userSession?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    req.user = {
      id: userId,
      username: userSession?.username,
      display_name: userSession?.display_name,
    };

    next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err);
    res.status(500).json({ error: "Internal authentication error" });
  }
}

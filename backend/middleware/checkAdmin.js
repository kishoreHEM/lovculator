// backend/middleware/checkAdmin.js
export function checkAdmin(req, res, next) {
  try {
    const user = req.session?.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }
    if (user.is_admin === true) {
      return next(); // ✅ Admin allowed
    }
    return res.status(403).json({ error: "Access denied: Admins only." });
  } catch (err) {
    console.error("⚠️ Admin check error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}


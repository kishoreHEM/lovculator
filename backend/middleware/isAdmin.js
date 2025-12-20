import pool from "../db.js";

export async function isAdmin(req, res, next) {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { rows } = await pool.query(
      "SELECT is_admin FROM users WHERE id = $1",
      [userId]
    );

    if (!rows.length || rows[0].is_admin !== true) {
      return res.status(403).json({ error: "Admin only" });
    }

    next();
  } catch (err) {
    console.error("isAdmin error:", err);
    res.status(500).json({ error: "Authorization failed" });
  }
}

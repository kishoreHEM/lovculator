import pool from "../db.js";

export async function generateUniqueUsername(firstName) {
  const base = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  let username = base;
  let suffix = 0;

  while (true) {
    const exists = await pool.query(
      "SELECT 1 FROM users WHERE username = $1",
      [username]
    );

    if (exists.rows.length === 0) break;

    suffix++;
    username = `${base}${suffix}`;
  }

  return username;
}

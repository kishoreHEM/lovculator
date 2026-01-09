// backend/middleware/auth.js

/**
 * OPTIONAL AUTH
 * -----------------
 * Use this globally (app.use)
 * - Allows guests
 * - Attaches req.user if logged in
 * - NEVER blocks or redirects
 */
export function optionalAuth(req, res, next) {
  if (req.session?.user && req.session.user.id) {
    req.user = req.session.user;
  } else {
    req.user = null;
  }
  next();
}

/**
 * REQUIRED AUTH
 * -----------------
 * Use ONLY on protected APIs
 * - Blocks guests
 * - Returns 401 (JSON)
 * - NEVER calls next() on failure
 */
export function requireAuth(req, res, next) {
  const user = req.session?.user;

  if (!user || !user.id) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Please log in to perform this action"
    });
  }

  req.user = user;
  next();
}

/**
 * DEFAULT EXPORT (BACKWARD COMPAT)
 * -----------------
 * Acts as optionalAuth
 * So existing imports don’t break
 */
export default optionalAuth;

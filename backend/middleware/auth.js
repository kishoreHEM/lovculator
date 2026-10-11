// backend/middleware/auth.js

/**
 * OPTIONAL AUTH
 * -----------------
 * Use globally (app.use) or on endpoints with optional user context.
 * - Allows guests (req.user = null)
 * - Attaches req.user if logged in
 * - Never blocks or redirects
 */
export function optionalAuth(req, res, next) {
  const user = req.session?.user;
  const userId = user?.id || req.session?.userId;

  if (userId) {
    req.user = user && user.id ? user : { id: userId };
  } else {
    req.user = null;
  }
  next();
}

/**
 * REQUIRED AUTH
 * -----------------
 * Use on protected API endpoints.
 * - Blocks guests with 401 Unauthorized JSON
 * - Populates req.user on success
 * - Never calls next() on failure
 */
export function requireAuth(req, res, next) {
  const user = req.session?.user;
  const userId = user?.id || req.session?.userId;

  if (!userId) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Please log in to perform this action"
    });
  }

  req.user = user && user.id ? user : { id: userId };
  next();
}

// Aliases for compatibility
export const auth = requireAuth;
export default requireAuth;


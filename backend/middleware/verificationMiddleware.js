// middleware/verificationMiddleware.js

export const requireVerification = (req, res, next) => {
  if (!req.session?.user?.email_verified) {
    // Check grace period
    return res.status(403).json({
      error: "Email verification required",
      message: "Please verify your email to access this feature.",
      code: "EMAIL_VERIFICATION_REQUIRED"
    });
  }
  next();
};

export const optionalVerification = (req, res, next) => {
  // Just attach verification status to request
  req.requiresVerification = !req.session?.user?.email_verified;
  next();
};

export const checkGracePeriod = async (req, res, next) => {
  if (!req.session?.user?.id) return next();
  
  try {
    const result = await pool.query(
      `SELECT email_verified,
              EXTRACT(DAY FROM NOW() - created_at) as days_since_signup
       FROM users WHERE id = $1`,
      [req.session.user.id]
    );
    
    if (result.rows[0]) {
      const user = result.rows[0];
      const GRACE_PERIOD = 7;
      
      req.verificationStatus = {
        verified: user.email_verified,
        inGracePeriod: !user.email_verified && user.days_since_signup <= GRACE_PERIOD,
        daysLeft: GRACE_PERIOD - user.days_since_signup,
        gracePeriodExpired: !user.email_verified && user.days_since_signup > GRACE_PERIOD
      };
    }
  } catch (err) {
    console.error("Error checking grace period:", err);
  }
  
  next();
};
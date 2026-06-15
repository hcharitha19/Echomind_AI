// middleware/auth.js — JWT verification middleware
const jwt  = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * verifyToken — protects routes requiring a logged-in user.
 * Reads JWT from Authorization header OR httpOnly cookie.
 */
const verifyToken = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check Authorization header: "Bearer <token>"
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    // 2. Fallback: httpOnly cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken; /

    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // 3. Verify
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please log in again.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
        code: 'TOKEN_INVALID',
      });
    }

    // 4. Confirm user still exists and is active
    const [user] = await query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account not found or deactivated.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error during auth.' });
  }
};

/**
 * optionalAuth — attaches user if token present, but doesn't block.
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
    if (!token && req.cookies?.accessToken) token = req.cookies.accessToken;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [user] = await query(
          'SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
          [decoded.id]
        );
        if (user) req.user = user;
      } catch (_) { /* ignore */ }
    }
    next();
  } catch (err) {
    next();
  }
};

/**
 * requireRole — role-based access control.
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
  }
  next();
};

module.exports = { verifyToken, optionalAuth, requireRole };

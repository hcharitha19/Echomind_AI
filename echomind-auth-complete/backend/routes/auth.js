// routes/auth.js — Register · Login · Logout · Refresh · Profile
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { verifyToken } = require('../middleware/auth');

/* ── helpers ─────────────────────────────────────────────────── */
const SALT_ROUNDS = 12;

const signAccess = (id, email, role) =>
  jwt.sign({ id, email, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const signRefresh = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days
    path:     '/api/auth/refresh',
  });
};

const logAudit = async (userId, email, ip, userAgent, status) => {
  try {
    await query(
      'INSERT INTO login_logs (user_id, email, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?)',
      [userId || null, email, ip, userAgent?.slice(0, 500) || null, status]
    );
  } catch (_) { /* non-blocking */ }
};

const safeUser = (u) => ({
  id:         u.id,
  name:       u.name,
  email:      u.email,
  role:       u.role,
  avatarUrl:  u.avatar_url,
  isVerified: Boolean(u.is_verified),
  createdAt:  u.created_at,
  lastLogin:  u.last_login,
});

/* ── validation rules ────────────────────────────────────────── */
const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('password')
    .isLength({ min: 8 })
    .matches(/[A-Z]/).withMessage('Password needs an uppercase letter.')
    .matches(/[0-9]/).withMessage('Password needs a number.')
    .withMessage('Password must be at least 8 characters.'),
];

const loginRules = [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('password').notEmpty().withMessage('Password required.'),
];

/* ── POST /api/auth/register ─────────────────────────────────── */
router.post('/register', registerRules, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const ip        = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Duplicate check
    const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), email, hash]
    );
    const userId = result.insertId;

    const accessToken  = signAccess(userId, email, 'user');
    const refreshToken = signRefresh(userId);

    // Store refresh token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, refreshToken, expiresAt]
    );

    await query('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
    await logAudit(userId, email, ip, userAgent, 'success');

    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success:     true,
      message:     'Account created successfully!',
      accessToken,
      user:        { id: userId, name: name.trim(), email, role: 'user', isVerified: false },
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

/* ── POST /api/auth/login ────────────────────────────────────── */
router.post('/login', loginRules, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;
    const ip        = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const users = await query(
      'SELECT id, name, email, password_hash, role, is_active, is_verified, avatar_url, created_at, last_login FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      await logAudit(null, email, ip, userAgent, 'failed');
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account deactivated. Contact support.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await logAudit(user.id, email, ip, userAgent, 'failed');
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const accessToken  = signAccess(user.id, user.email, user.role);
    const refreshToken = signRefresh(user.id);

    // Rotate refresh token — delete old ones, insert new
    await query('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < NOW()', [user.id]);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );

    await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    await logAudit(user.id, email, ip, userAgent, 'success');

    setRefreshCookie(res, refreshToken);

    return res.json({
      success:     true,
      message:     'Logged in successfully!',
      accessToken,
      user:        safeUser(user),
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

/* ── POST /api/auth/logout ───────────────────────────────────── */
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    await logAudit(req.user.id, req.user.email, req.ip, req.headers['user-agent'], 'logout');

    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ success: false, message: 'Logout failed.' });
  }
});

/* ── POST /api/auth/refresh ──────────────────────────────────── */
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token not found.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (_) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.', code: 'REFRESH_INVALID' });
    }

    // Validate token exists in DB
    const stored = await query(
      'SELECT id, user_id FROM refresh_tokens WHERE token = ? AND expires_at > NOW() LIMIT 1',
      [token]
    );
    if (stored.length === 0) {
      return res.status(401).json({ success: false, message: 'Refresh token revoked or expired.' });
    }

    const users = await query(
      'SELECT id, email, role, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );
    if (!users.length || !users[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];

    // Rotate: delete old, issue new
    const newRefresh = signRefresh(user.id);
    const expiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query('DELETE FROM refresh_tokens WHERE id = ?', [stored[0].id]);
    await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, newRefresh, expiresAt]);

    const newAccess = signAccess(user.id, user.email, user.role);
    setRefreshCookie(res, newRefresh);

    return res.json({ success: true, accessToken: newAccess });
  } catch (err) {
    console.error('Refresh error:', err.message);
    res.status(500).json({ success: false, message: 'Token refresh failed.' });
  }
});

/* ── GET /api/auth/me ────────────────────────────────────────── */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const users = await query(
      'SELECT id, name, email, role, avatar_url, is_verified, last_login, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user: safeUser(users[0]) });
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

/* ── PUT /api/auth/profile ───────────────────────────────────── */
router.put('/profile', verifyToken, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    const { name } = req.body;
    if (name) {
      await query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), req.user.id]);
    }
    const [updated] = await query(
      'SELECT id, name, email, role, avatar_url, is_verified, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    return res.json({ success: true, message: 'Profile updated.', user: safeUser(updated) });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

/* ── PUT /api/auth/change-password ──────────────────────────── */
router.put('/change-password', verifyToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const [user] = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Current password incorrect.' });

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    // Invalidate all refresh tokens for security
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });

    return res.json({ success: true, message: 'Password changed. Please log in again.' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

module.exports = router;

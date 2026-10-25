import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/db.js';
import { validate, registerSchema, loginSchema } from '../middleware/validation.js';

const router = Router();

// Register new user
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.validatedBody;

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email address already exists.',
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, avatar_url, created_at`,
      [name, email, passwordHash]
    );

    const user = userResult.rows[0];

    // Seed default settings for the new user
    await query(
      `INSERT INTO user_settings (user_id, theme, reduced_motion, task_reminders_enabled, completion_notifications_enabled)
       VALUES ($1, 'dark', false, true, true)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    // Regenerate session to prevent session fixation and set userId
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      return res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar_url || null,
          createdAt: user.created_at,
        },
      });
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validatedBody;

    // Fetch user with hashed password and avatar_url
    const result = await query(
      'SELECT id, name, email, password_hash, avatar_url, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
      });
    }

    // Regenerate session ID and attach userId
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar_url || null,
          createdAt: user.created_at,
        },
      });
    });
  } catch (err) {
    next(err);
  }
});

// Logout
router.post('/logout', (req, res, next) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('connect.sid', { path: '/' });
      return res.json({ message: 'Successfully logged out' });
    });
  } else {
    return res.json({ message: 'Already logged out' });
  }
});

// Get current user session
router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: 'Unauthenticated',
        message: 'No active session found',
        user: null,
      });
    }

    const result = await query(
      'SELECT id, name, email, avatar_url, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      // Session exists for deleted user
      req.session.destroy();
      return res.status(401).json({
        error: 'Unauthenticated',
        message: 'User no longer exists',
        user: null,
      });
    }

    const user = result.rows[0];
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url || null,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

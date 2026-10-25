import { Router } from 'express';
import { query } from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// GET /api/settings - Retrieve settings for the logged in user
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.theme, s.reduced_motion, s.task_reminders_enabled, s.completion_notifications_enabled, s.updated_at,
              u.name, u.email
       FROM user_settings s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      // Create defaults if not found
      await query(
        `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [req.userId]
      );
      const userRes = await query('SELECT name, email FROM users WHERE id = $1', [req.userId]);
      const user = userRes.rows[0] || {};
      return res.json({
        settings: {
          theme: 'dark',
          reducedMotion: false,
          taskRemindersEnabled: true,
          completionNotificationsEnabled: true,
          name: user.name || '',
          email: user.email || '',
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const row = result.rows[0];
    return res.json({
      settings: {
        theme: row.theme,
        reducedMotion: row.reduced_motion,
        taskRemindersEnabled: row.task_reminders_enabled,
        completionNotificationsEnabled: row.completion_notifications_enabled,
        name: row.name,
        email: row.email,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings - Update user settings and profile
router.patch('/', async (req, res, next) => {
  try {
    const {
      theme,
      reducedMotion,
      taskRemindersEnabled,
      completionNotificationsEnabled,
      name,
    } = req.body;

    // If profile name is updated
    if (name !== undefined && name.trim()) {
      await query(
        `UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [name.trim(), req.userId]
      );
    }

    // Build update for user_settings
    const setClauses = [];
    const params = [req.userId];
    let paramIndex = 2;

    if (theme !== undefined) {
      setClauses.push(`theme = $${paramIndex}`);
      params.push(theme);
      paramIndex++;
    }

    if (reducedMotion !== undefined) {
      setClauses.push(`reduced_motion = $${paramIndex}`);
      params.push(Boolean(reducedMotion));
      paramIndex++;
    }

    if (taskRemindersEnabled !== undefined) {
      setClauses.push(`task_reminders_enabled = $${paramIndex}`);
      params.push(Boolean(taskRemindersEnabled));
      paramIndex++;
    }

    if (completionNotificationsEnabled !== undefined) {
      setClauses.push(`completion_notifications_enabled = $${paramIndex}`);
      params.push(Boolean(completionNotificationsEnabled));
      paramIndex++;
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      const sql = `
        UPDATE user_settings
        SET ${setClauses.join(', ')}
        WHERE user_id = $1
      `;
      await query(sql, params);
    }

    // Fetch and return the updated combined object
    const result = await query(
      `SELECT s.theme, s.reduced_motion, s.task_reminders_enabled, s.completion_notifications_enabled, s.updated_at,
              u.name, u.email
       FROM user_settings s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id = $1`,
      [req.userId]
    );

    const row = result.rows[0];
    return res.json({
      message: 'Settings updated successfully',
      settings: {
        theme: row.theme,
        reducedMotion: row.reduced_motion,
        taskRemindersEnabled: row.task_reminders_enabled,
        completionNotificationsEnabled: row.completion_notifications_enabled,
        name: row.name,
        email: row.email,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

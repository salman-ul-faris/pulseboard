import { Router } from 'express';
import { query } from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';
import { handleAvatarUpload } from '../middleware/upload.js';
import storage from '../services/storage.js';

const router = Router();

router.use(requireAuth);

// GET /api/settings - Retrieve settings and profile for the logged in user
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.theme, s.reduced_motion, s.task_reminders_enabled, s.completion_notifications_enabled, s.updated_at,
              u.name, u.email, u.avatar_url
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
      const userRes = await query('SELECT name, email, avatar_url FROM users WHERE id = $1', [req.userId]);
      const user = userRes.rows[0] || {};
      return res.json({
        settings: {
          theme: 'dark',
          reducedMotion: false,
          taskRemindersEnabled: true,
          completionNotificationsEnabled: true,
          name: user.name || '',
          email: user.email || '',
          avatarUrl: user.avatar_url || null,
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
        avatarUrl: row.avatar_url || null,
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
              u.name, u.email, u.avatar_url
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
        avatarUrl: row.avatar_url || null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/profile-picture/signature - Request a signed upload ticket for Cloudinary direct upload
router.get('/profile-picture/signature', (req, res, next) => {
  try {
    const signData = storage.createUploadSignature({ userId: req.userId });
    if (!signData) {
      return res.json({
        directUploadSupported: false,
        message: 'Cloudinary credentials not configured; fallback to standard multipart upload',
      });
    }
    return res.json({
      directUploadSupported: true,
      ...signData,
    });
  } catch (err) {
    next(err);
  }
});

// Direct upload commit handler for Cloudinary signed uploads
async function handleDirectUploadCommit(req, res, next) {
  try {
    const { publicId, avatarUrl } = req.body || {};

    if (!publicId || !avatarUrl) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Both publicId and avatarUrl are required.',
      });
    }

    // Security check: Verify that publicId strictly belongs to this authenticated user!
    const sanitizedUserId = req.userId.replace(/[^a-zA-Z0-9]/g, '');
    if (!publicId.includes(`avatar_${sanitizedUserId}_`)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Security validation failed: asset identifier does not match authenticated user.',
      });
    }

    // Validate URL scheme: must start with https://res.cloudinary.com/
    if (!avatarUrl.startsWith('https://res.cloudinary.com/')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid image URL domain.',
      });
    }

    // 1. Fetch current avatar info for the authenticated user
    const currentRes = await query(
      'SELECT avatar_url, avatar_key FROM users WHERE id = $1',
      [req.userId]
    );
    const previousKey = currentRes.rows[0]?.avatar_key;

    // 2. Update database record with new image URL and storage key
    try {
      await query(
        `UPDATE users
         SET avatar_url = $1, avatar_key = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [avatarUrl, publicId, req.userId]
      );
    } catch (dbErr) {
      // Failure-safe cleanup: If database commit fails, delete the newly uploaded object
      await storage.deleteAvatar(publicId, req.userId).catch(() => {});
      throw dbErr;
    }

    // 3. Clean up previous avatar object only after new record is committed
    if (previousKey && previousKey !== publicId) {
      storage.deleteAvatar(previousKey, req.userId).catch((err) => {
        console.warn('[STORAGE] Non-critical warning deleting old avatar:', err.message);
      });
    }

    return res.json({
      message: 'Profile picture updated successfully',
      avatarUrl,
    });
  } catch (err) {
    next(err);
  }
}

// Multipart buffer commit handler (for local dev / automated test suite)
async function handleMultipartUploadCommit(req, res, next) {
  let uploadedAvatar = null;
  try {
    // 1. Fetch current avatar info for the authenticated user
    const currentRes = await query(
      'SELECT avatar_url, avatar_key FROM users WHERE id = $1',
      [req.userId]
    );

    const previousKey = currentRes.rows[0]?.avatar_key;

    // 2. Upload new sanitized image buffer to persistent storage
    uploadedAvatar = await storage.uploadAvatar({
      buffer: req.processedAvatar.buffer,
      userId: req.userId,
    });

    // 3. Update database record with new image URL and storage key
    try {
      await query(
        `UPDATE users
         SET avatar_url = $1, avatar_key = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [uploadedAvatar.url, uploadedAvatar.key, req.userId]
      );
    } catch (dbErr) {
      // Failure-safe cleanup: If database commit fails, delete the newly uploaded object
      // so we do not leave orphaned files and the previous picture remains intact
      await storage.deleteAvatar(uploadedAvatar.key, req.userId).catch(() => {});
      throw dbErr;
    }

    // 4. Safely clean up previous avatar object only after new record is committed
    if (previousKey && previousKey !== uploadedAvatar.key) {
      storage.deleteAvatar(previousKey, req.userId).catch((err) => {
        console.warn('[STORAGE] Non-critical warning deleting old avatar:', err.message);
      });
    }

    return res.json({
      message: 'Profile picture updated successfully',
      avatarUrl: uploadedAvatar.url,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/settings/profile-picture - Upload or replace profile picture (supports signed direct upload & multipart)
router.post('/profile-picture', (req, res, next) => {
  if (req.is('application/json') || (req.body && req.body.publicId)) {
    return handleDirectUploadCommit(req, res, next);
  }
  return handleAvatarUpload(req, res, (err) => {
    if (err) return next(err);
    return handleMultipartUploadCommit(req, res, next);
  });
});


// DELETE /api/settings/profile-picture - Remove profile picture and restore default avatar
router.delete('/profile-picture', async (req, res, next) => {
  try {
    // 1. Fetch current avatar key
    const currentRes = await query(
      'SELECT avatar_key, avatar_url FROM users WHERE id = $1',
      [req.userId]
    );

    const existingKey = currentRes.rows[0]?.avatar_key;

    // 2. Clear database fields
    await query(
      `UPDATE users
       SET avatar_url = NULL, avatar_key = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [req.userId]
    );

    // 3. Remove stored object from storage provider
    if (existingKey) {
      await storage.deleteAvatar(existingKey, req.userId).catch((err) => {
        console.warn('[STORAGE] Non-critical warning deleting avatar object:', err.message);
      });
    }

    return res.json({
      message: 'Profile picture removed successfully',
      avatarUrl: null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

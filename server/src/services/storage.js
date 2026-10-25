import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if Cloudinary credentials are configured
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('[STORAGE] Persistent Cloudinary storage initialized for cloud deployment.');
} else {
  console.warn('[STORAGE] Cloudinary credentials not detected. Operating with persistent local storage adapter for development/testing.');
}

// Local storage directory setup for dev / test fallback
const localUploadsDir = path.resolve(__dirname, '../../../data/uploads/avatars');
if (!isCloudinaryConfigured) {
  if (!fs.existsSync(localUploadsDir)) {
    fs.mkdirSync(localUploadsDir, { recursive: true });
  }
}

/**
 * Upload profile picture buffer to storage provider
 * @param {Object} params
 * @param {Buffer} params.buffer - Processed image buffer (WebP)
 * @param {string} params.userId - Authenticated user UUID
 * @returns {Promise<{ url: string, key: string, provider: 'cloudinary' | 'local' }>}
 */
export async function uploadAvatar({ buffer, userId }) {
  if (!buffer || !userId) {
    throw new Error('Image buffer and userId are required for avatar upload');
  }

  const randomSuffix = crypto.randomBytes(12).toString('hex');
  const safeFilename = `user_${userId.replace(/[^a-zA-Z0-9]/g, '')}_${randomSuffix}`;

  // 1. Cloudinary upload if configured
  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'pulseboard/avatars',
          public_id: safeFilename,
          resource_type: 'image',
          format: 'webp',
          overwrite: true,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          ],
        },
        (error, result) => {
          if (error) {
            console.error('[STORAGE ERROR] Cloudinary upload failed:', error.message);
            return reject(new Error('Failed to upload image to cloud storage provider'));
          }
          return resolve({
            url: result.secure_url,
            key: result.public_id,
            provider: 'cloudinary',
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  // 2. Local storage adapter (development & automated test fallback)
  const fullFilename = `${safeFilename}.webp`;
  const filePath = path.join(localUploadsDir, fullFilename);

  await fs.promises.writeFile(filePath, buffer);

  return {
    url: `/api/uploads/avatars/${fullFilename}`,
    key: fullFilename,
    provider: 'local',
  };
}

/**
 * Delete profile picture from storage provider
 * @param {string} key - Object key / public ID
 * @param {string} userId - Authenticated user UUID for ownership check
 */
export async function deleteAvatar(key, userId) {
  if (!key) return;

  // Enforce ownership check: key must contain user ID token
  const sanitizedUserId = (userId || '').replace(/[^a-zA-Z0-9]/g, '');
  if (sanitizedUserId && !key.includes(sanitizedUserId)) {
    console.warn(`[SECURITY] Blocked attempt to delete avatar key '${key}' not matching user '${userId}'`);
    return;
  }

  if (isCloudinaryConfigured) {
    try {
      await cloudinary.uploader.destroy(key, { invalidate: true });
    } catch (err) {
      console.warn('[STORAGE] Failed to destroy Cloudinary object:', err.message);
    }
    return;
  }

  // Local storage deletion
  try {
    const filename = path.basename(key);
    const filePath = path.join(localUploadsDir, filename);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (err) {
    console.warn('[STORAGE] Failed to remove local file:', err.message);
  }
}

/**
 * Check whether cloud object storage is configured
 */
export function isStorageCloudConfigured() {
  return isCloudinaryConfigured;
}

export default {
  uploadAvatar,
  deleteAvatar,
  isStorageCloudConfigured,
};

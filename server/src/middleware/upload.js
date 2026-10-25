import multer from 'multer';

// Max file size: 5 MB
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

let sharpInstance = null;
async function getSharp() {
  if (sharpInstance) return sharpInstance;
  try {
    const mod = await import('sharp');
    sharpInstance = mod.default || mod;
    return sharpInstance;
  } catch (err) {
    console.warn('[STORAGE] Sharp image library is not loaded in this runtime environment:', err.message);
    return null;
  }
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only 1 file per request
  },
  fileFilter: (req, file, cb) => {
    // Preliminary MIME check - will be strictly validated via magic bytes
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      const err = new Error('Invalid file type. Only JPEG, PNG, and WebP raster images are allowed.');
      err.status = 400;
      return cb(err, false);
    }
    cb(null, true);
  },
});

/**
 * Validates actual file signature (magic bytes) to ensure file is genuine raster image
 * and not an executable, script, HTML, or SVG disguised with an image extension.
 * @param {Buffer} buffer
 * @returns {string | null} 'jpeg' | 'png' | 'webp' or null if invalid
 */
export function validateImageSignature(buffer) {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // Reject SVG / XML / HTML payloads immediately
  const headerText = buffer.slice(0, 100).toString('utf8').toLowerCase();
  if (
    headerText.includes('<svg') ||
    headerText.includes('<?xml') ||
    headerText.includes('<!doctype') ||
    headerText.includes('<html') ||
    headerText.includes('<script')
  ) {
    return null;
  }

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP signature: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Middleware that handles single avatar file upload, verifies file signatures,
 * decodes and validates raster data with sharp, strips metadata, and re-encodes as clean WebP.
 */
export function handleAvatarUpload(req, res, next) {
  const uploadSingle = upload.single('avatar');

  uploadSingle(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File Too Large',
          message: 'The selected image exceeds the maximum allowed size of 5 MB.',
        });
      }
      return res.status(err.status || 400).json({
        error: 'Upload Error',
        message: err.message || 'Error processing uploaded file.',
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No image file provided. Please select an image to upload.',
      });
    }

    // Strict Magic Number / Signature Verification
    const detectedFormat = validateImageSignature(req.file.buffer);
    if (!detectedFormat) {
      return res.status(400).json({
        error: 'Invalid File',
        message: 'The uploaded file is not a supported raster image (JPEG, PNG, or WebP). SVG and executable files are prohibited.',
      });
    }

    try {
      const sharp = await getSharp();
      if (!sharp) {
        // Fallback if sharp is not available in serverless: use validated raster buffer
        req.processedAvatar = {
          buffer: req.file.buffer,
          format: detectedFormat,
          size: req.file.buffer.length,
        };
        return next();
      }

      // Decode, sanitize, auto-orient, resize, and re-encode with Sharp
      const processedBuffer = await sharp(req.file.buffer, {
        failOn: 'error',
        limitInputPixels: 16777216, // Max ~4096x4096 to prevent decompression bombs
      })
        .rotate() // Auto-orient using EXIF orientation before stripping
        .resize(400, 400, {
          fit: 'cover',
          position: 'center',
          withoutEnlargement: false,
        })
        .webp({
          quality: 85,
          effort: 4,
          lossless: false,
        })
        .toBuffer();

      req.processedAvatar = {
        buffer: processedBuffer,
        format: 'webp',
        size: processedBuffer.length,
      };

      next();
    } catch (sharpError) {
      console.warn('[SECURITY] Image decoding failed with Sharp:', sharpError.message);
      return res.status(400).json({
        error: 'Corrupted Image',
        message: 'The provided image file is corrupt or could not be decoded safely.',
      });
    }
  });
}


export default {
  handleAvatarUpload,
  validateImageSignature,
  MAX_FILE_SIZE,
};

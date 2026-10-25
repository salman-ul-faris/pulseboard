import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import tasksRoutes from './routes/tasks.js';
import settingsRoutes from './routes/settings.js';
import healthRoutes from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getPool } from './db/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Trust reverse proxy for Render / Cloudflare / Vercel HTTPS propagation
  app.set('trust proxy', 1);

  // Security headers: permit Cloudinary CDN for profile pictures in imgSrc
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://*.cloudinary.com'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", 'http://localhost:*', 'https://*'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // Allowed origins for CORS (Netlify frontend, Vercel, local development, Render)
  const allowedOrigins = [
    process.env.CLIENT_ORIGIN,
    'http://localhost:5173',
    'http://localhost:5000',
    'http://localhost:3000',
    'http://localhost:8888',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:8888',
  ].filter(Boolean);

  const isOriginAllowed = (origin) => {
    if (!origin) return true; // Mobile, curl, same-origin
    if (allowedOrigins.includes(origin)) return true;
    if (origin.endsWith('.netlify.app') || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) return true;
    return false;
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
    })
  );

  // Origin / CSRF verification middleware for state-changing requests
  app.use((req, res, next) => {
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (isMutating && req.headers.origin) {
      if (!isOriginAllowed(req.headers.origin)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Origin verification failed',
        });
      }
    }
    next();
  });

  // Body parser with size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Session store configuration: PostgreSQL persistent store for Netlify/Postgres, Memory fallback for test/dev
  const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const isProduction = process.env.NODE_ENV === 'production' || isServerless;
  const pool = getPool();
  let sessionStore = undefined;

  if (pool) {
    const PgSession = connectPgSimple(session);
    sessionStore = new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
    console.log('[SESSION] Using PostgreSQL persistent session store (connect-pg-simple)');
  }

  // Cookie policy: Netlify hosts frontend & functions on same origin, allowing secure Lax cookies
  const sameSiteConfig = process.env.COOKIE_SAMESITE || (isServerless ? 'lax' : (isProduction ? 'none' : 'lax'));
  const cookieSecure = sameSiteConfig === 'none' ? true : (isProduction && process.env.COOKIE_SECURE !== 'false');

  app.use(
    session({
      name: 'pulseboard.sid',
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'pulseboard_secure_entropy_key_change_in_prod_89234710',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: sameSiteConfig,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );


  // Key generator that safely supports Netlify Functions, proxies, and mock tests
  const getClientIp = (req) => {
    return (
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['client-ip'] ||
      req.ip ||
      req.socket?.remoteAddress ||
      '127.0.0.1'
    );
  };

  // Rate limiter for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIp,
    validate: { ip: false, xForwardedForHeader: false },
    message: {
      error: 'Too Many Requests',
      message: 'Too many authentication attempts. Please try again in a few minutes.',
    },
  });

  // Dedicated rate limiter for avatar uploads and removals (prevents storage quota abuse)
  const avatarLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // 30 avatar operations per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIp,
    validate: { ip: false, xForwardedForHeader: false },
    message: {
      error: 'Too Many Requests',
      message: 'Too many profile picture update requests. Please wait a few minutes.',
    },
  });


  // Safe static serving for local avatar storage fallback (development / testing)
  const localUploadsDir = path.resolve(__dirname, '../../../data/uploads/avatars');
  if (fs.existsSync(localUploadsDir)) {
    app.use('/api/uploads/avatars', express.static(localUploadsDir, {
      maxAge: '1d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      },
    }));
  }

  // Mount API routes
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/settings/profile-picture', avatarLimiter);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/health', healthRoutes);

  // Serve static client build if present (e.g. for Render single-service deployment)
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Central error handling middleware
  app.use(errorHandler);

  return app;
}

export default createApp;

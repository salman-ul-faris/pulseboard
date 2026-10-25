import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let pool = null;
let pgliteInstance = null;
let isConnected = false;
let dbEngine = 'unknown';

export async function getDb() {
  if (isConnected) {
    return { query, pool, dbEngine };
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && !databaseUrl.includes('localhost:5432') && !databaseUrl.includes('127.0.0.1:5432')) {
    try {
      const isProd = process.env.NODE_ENV === 'production';
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: isProd ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      const res = await pool.query('SELECT NOW()');
      if (res.rows.length > 0) {
        isConnected = true;
        dbEngine = 'postgresql';
        console.log('[DB] Connected to PostgreSQL via DATABASE_URL');
        return { query, pool, dbEngine };
      }
    } catch (err) {
      console.warn('[DB] Failed to connect to PostgreSQL via DATABASE_URL:', err.message);
      pool = null;
    }
  }

  // Fallback to embedded PGlite (real Postgres engine in Node WASM with persistence)
  try {
    const { PGlite } = await import('@electric-sql/pglite');
    let dataDir = process.env.PGLITE_DATA_DIR;
    if (!dataDir) {
      const workspacePath = path.resolve(__dirname, '../../../data/pglite');
      // If path contains parentheses, use LOCALAPPDATA / TEMP to avoid Emscripten WASM aborts
      if (workspacePath.includes('(') || workspacePath.includes(')')) {
        dataDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || 'C:/Users/Public', 'pulseboard_pglite');
      } else {
        dataDir = workspacePath;
      }
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    } else {
      // Clean up stale lock files from previous abnormal terminations
      const lockFiles = ['postmaster.pid', '.s.PGSQL.5432.lock', '.s.PGSQL.5432.lock.out'];
      for (const lf of lockFiles) {
        const fullPath = path.join(dataDir, lf);
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (_) {}
        }
      }
    }

    try {
      pgliteInstance = new PGlite(dataDir);
      await pgliteInstance.waitReady;
      isConnected = true;
      dbEngine = 'pglite';
      console.log(`[DB] Connected to embedded PostgreSQL engine (PGlite) at ${dataDir}`);
      return { query, pool: null, dbEngine };
    } catch (fsErr) {
      console.warn('[DB] Persistent PGlite initialization failed, falling back to in-memory PGlite:', fsErr.message);
      pgliteInstance = new PGlite();
      await pgliteInstance.waitReady;
      isConnected = true;
      dbEngine = 'pglite-memory';
      console.log('[DB] Connected to in-memory embedded PostgreSQL engine (PGlite)');
      return { query, pool: null, dbEngine };
    }
  } catch (err) {
    console.error('[DB] Failed to initialize embedded database engine:', err);
    throw err;
  }
}

export async function query(text, params = []) {
  if (!isConnected) {
    await getDb();
  }

  if (pool) {
    const res = await pool.query(text, params);
    return res;
  }

  if (pgliteInstance) {
    const res = await pgliteInstance.query(text, params);
    return {
      rows: res.rows || [],
      rowCount: res.affectedRows || res.rows?.length || 0,
    };
  }

  throw new Error('Database not initialized');
}

export async function checkHealth() {
  try {
    const res = await query('SELECT 1 as healthy');
    return {
      status: 'connected',
      engine: dbEngine,
      ok: res.rows.length > 0,
    };
  } catch (err) {
    return {
      status: 'disconnected',
      engine: dbEngine,
      ok: false,
      error: err.message,
    };
  }
}

export async function exec(sql) {
  if (!isConnected) {
    await getDb();
  }

  if (pool) {
    return await pool.query(sql);
  }

  if (pgliteInstance) {
    return await pgliteInstance.exec(sql);
  }

  throw new Error('Database not initialized');
}

export async function runMigrations() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[DB] Running database migrations...');
  await exec(schemaSql);
  console.log('[DB] Migrations executed successfully.');
}

export function getPool() {
  return pool;
}

export default {
  getDb,
  getPool,
  query,
  exec,
  checkHealth,
  runMigrations,
};

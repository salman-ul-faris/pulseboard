import pg from 'pg';
import path from 'path';
import fs from 'fs';

const { Pool } = pg;

let pool = null;
let pgliteInstance = null;
let isConnected = false;
let dbEngine = 'unknown';

// Resolve schema.sql path across development, test runners, and Netlify Functions
export function resolveSchemaPath() {
  const candidates = [
    path.resolve(process.cwd(), 'server/src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    typeof __dirname !== 'undefined' ? path.resolve(__dirname, 'schema.sql') : null,
    typeof __dirname !== 'undefined' ? path.resolve(__dirname, 'server/src/db/schema.sql') : null,
    typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../server/src/db/schema.sql') : null,
    typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../../server/src/db/schema.sql') : null,
    path.resolve(process.cwd(), 'schema.sql'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

export async function getDb() {
  if (isConnected) {
    return { query, pool, dbEngine };
  }

  const databaseUrl = process.env.DATABASE_URL;
  const isNetlifyDev = Boolean(process.env.NETLIFY_DEV);
  const isNetlifyProd = Boolean(process.env.NETLIFY && !process.env.NETLIFY_DEV);
  const isLambdaProd = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.NETLIFY_DEV);
  const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const isProd = (process.env.NODE_ENV === 'production' || isNetlifyProd || isLambdaProd) && !isNetlifyDev;

  // In serverless, limit pool size to avoid exhausting PostgreSQL connection limits across function instances
  const poolMax = process.env.DB_POOL_MAX
    ? parseInt(process.env.DB_POOL_MAX, 10)
    : (isServerless ? 2 : 10);


  if (databaseUrl && (!databaseUrl.includes('localhost:5432') && !databaseUrl.includes('127.0.0.1:5432') || isProd)) {
    try {
      const isRemote = isProd || databaseUrl.includes('render.com') || databaseUrl.includes('neon.tech') || databaseUrl.includes('supabase.co');
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: isRemote ? { rejectUnauthorized: false } : false,
        max: poolMax,
        idleTimeoutMillis: isServerless ? 10000 : 30000,
        connectionTimeoutMillis: 5000,
      });

      const res = await pool.query('SELECT NOW()');
      if (res.rows.length > 0) {
        isConnected = true;
        dbEngine = 'postgresql';
        console.log(`[DB] Connected to PostgreSQL via DATABASE_URL (engine: postgresql, poolMax: ${poolMax})`);
        return { query, pool, dbEngine };
      }
    } catch (err) {
      console.warn('[DB] Failed to connect to PostgreSQL via DATABASE_URL:', err.message);
      pool = null;
      if (isProd) {
        throw new Error(`[DB FATAL] Production database connection failed: ${err.message}`);
      }
    }
  }

  // Strict production guard: NEVER load or initialize PGlite WASM in production or Netlify functions
  if (isProd) {
    throw new Error(
      '[DB FATAL] DATABASE_URL is not configured or reachable. Embedded PGlite engine is disabled in production to protect memory.'
    );
  }

  // Fallback to embedded PGlite for local development and automated testing only
  try {
    let PGlite;
    try {
      const mod = await import('@electric-sql/pglite');
      PGlite = mod.PGlite;
    } catch (importErr) {
      const candidates = [
        path.resolve(process.cwd(), 'server/node_modules/@electric-sql/pglite/dist/index.js'),
        path.resolve(process.cwd(), 'node_modules/@electric-sql/pglite/dist/index.js'),
      ];
      const found = candidates.find((c) => fs.existsSync(c));
      if (found) {
        const fileUrl = 'file:///' + found.replace(/\\/g, '/');
        const mod = await import(fileUrl);
        PGlite = mod.PGlite;
      } else {
        throw importErr;
      }
    }
    let dataDir = process.env.PGLITE_DATA_DIR;
    if (!dataDir) {
      const workspacePath = path.resolve(process.cwd(), 'data/pglite');
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
      await runMigrations();
      return { query, pool: null, dbEngine };
    } catch (fsErr) {
      console.warn('[DB] Persistent PGlite initialization failed, falling back to in-memory PGlite:', fsErr.message);
      pgliteInstance = new PGlite();
      await pgliteInstance.waitReady;
      isConnected = true;
      dbEngine = 'pglite-memory';
      console.log('[DB] Connected to in-memory embedded PostgreSQL engine (PGlite)');
      await runMigrations();
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
  const schemaPath = resolveSchemaPath();
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log(`[DB] Running database migrations from ${schemaPath}...`);
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

import 'dotenv/config';
import { runMigrations } from './db.js';

async function main() {
  try {
    await runMigrations();
    console.log('[MIGRATE] Database is ready.');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATE] Migration failed:', err);
    process.exit(1);
  }
}

main();

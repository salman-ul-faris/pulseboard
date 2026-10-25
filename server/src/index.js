import 'dotenv/config';
import { createApp } from './app.js';
import { runMigrations, checkHealth } from './db/db.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    console.log('[PULSEBOARD] Initializing database...');
    await runMigrations();

    const health = await checkHealth();
    console.log(`[PULSEBOARD] Database initialized with engine: ${health.engine}`);

    const app = createApp();

    const server = app.listen(PORT, () => {
      console.log(`[PULSEBOARD] Server running on http://localhost:${PORT}`);
      console.log(`[PULSEBOARD] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown handling
    const shutdown = (signal) => {
      console.log(`\n[PULSEBOARD] Received ${signal}. Gracefully shutting down server...`);
      server.close(() => {
        console.log('[PULSEBOARD] HTTP server closed.');
        process.exit(0);
      });

      // Force exit if not closed within 10s
      setTimeout(() => {
        console.error('[PULSEBOARD] Forcing shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[PULSEBOARD FATAL] Server startup failed:', err);
    process.exit(1);
  }
}

bootstrap();

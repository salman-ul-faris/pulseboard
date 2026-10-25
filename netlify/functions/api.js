import serverless from 'serverless-http';
import { createApp } from '../../server/src/app.js';
import { getDb } from '../../server/src/db/db.js';

let appInstance = null;
let serverlessHandler = null;

/**
 * Netlify Functions Serverless Handler for PulseBoard Express API
 */
export const handler = async (event, context) => {
  // Prevent Lambda from waiting for empty event loop (retains pg connection pool sockets)
  context.callbackWaitsForEmptyEventLoop = false;

  // Path normalization: ensure requests reaching /.netlify/functions/api map cleanly to Express /api routes
  if (event.path && event.path.startsWith('/.netlify/functions/api')) {
    event.path = event.path.replace(/^\/\.netlify\/functions\/api/, '/api');
    if (!event.path) {
      event.path = '/api';
    }
  }

  // Lazy initialization of database connection and Express app
  if (!serverlessHandler) {
    try {
      await getDb();
    } catch (dbErr) {
      console.error('[NETLIFY API] Database initialization warning on cold start:', dbErr.message);
    }

    appInstance = createApp();
    serverlessHandler = serverless(appInstance, {
      binary: ['image/*', 'multipart/form-data', 'application/octet-stream'],
    });
  }

  try {
    return await serverlessHandler(event, context);
  } catch (err) {
    console.error('[NETLIFY API] Unhandled serverless invocation error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected server error occurred during request processing.',
      }),
    };
  }
};

export default handler;

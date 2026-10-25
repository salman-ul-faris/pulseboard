export function errorHandler(err, req, res, next) {
  // Check for Postgres unique violation error code
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A record with this information already exists.',
    });
  }

  // Check for invalid UUID syntax
  if (err.code === '22P02') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid identifier format.',
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  console.error('[SERVER ERROR]', {
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });

  return res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: isProd && statusCode === 500 ? 'An unexpected server error occurred.' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
}

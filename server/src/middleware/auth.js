export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource',
    });
  }

  req.userId = req.session.userId;
  next();
}

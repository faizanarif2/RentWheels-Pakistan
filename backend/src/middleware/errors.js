export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested endpoint was not found.' } });
}
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: { code: err.code || 'SERVER_ERROR', message: err.status ? err.message : 'Something went wrong. Please try again.' } });
}

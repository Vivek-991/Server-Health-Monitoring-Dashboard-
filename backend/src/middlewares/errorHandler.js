const logger = require('../utils/logger');

const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  logger.error(`${req.method} ${req.originalUrl} → ${statusCode}: ${message}`);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message).join('; ');
    return res.status(400).json({ success: false, statusCode: 400, message: messages, code: 'VALIDATION_ERROR' });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ success: false, statusCode: 409, message: `Duplicate value for ${field}`, code: 'DUPLICATE_KEY' });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid ID format', code: 'INVALID_ID' });
  }

  if (err.name === 'MongooseError' || (err.message && (err.message.includes('initial connection is complete') || err.message.includes('bufferCommands')))) {
    return res.status(503).json({
      success: false,
      statusCode: 503,
      message: 'Database connection unavailable. Please verify MONGO_URI in backend/.env or ensure MongoDB is running.',
      code: 'DB_DISCONNECTED',
    });
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;

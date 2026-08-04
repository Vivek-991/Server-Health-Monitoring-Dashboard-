const rateLimit = require('express-rate-limit');

const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests, please try again later.') => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });
};

const authLimiter = createRateLimiter(15 * 60 * 1000, 100, 'Too many authentication attempts. Try again in 15 minutes.');
const apiLimiter = createRateLimiter(15 * 60 * 1000, 1000);
const agentLimiter = createRateLimiter(60 * 1000, 120, 'Agent push rate exceeded.');

module.exports = { createRateLimiter, authLimiter, apiLimiter, agentLimiter };

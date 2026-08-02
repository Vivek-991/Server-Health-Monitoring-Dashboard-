const jwt = require('jsonwebtoken');

// Secret key from environment variable (or default fallback for dev)
const JWT_SECRET = process.env.JWT_SECRET || 'shd-jwt-secret-dev-key-2024';

// ── 1. Create a JWT Token ────────────────────────────────────────────────────
const generateToken = (userId, email) => {
  return jwt.sign(
    { id: userId, email },
    JWT_SECRET,
    { expiresIn: '7d' } // Token lasts for 7 days
  );
};

// ── 2. Verify a JWT Token ────────────────────────────────────────────────────
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// ── 3. Middleware to protect routes ──────────────────────────────────────────
const authenticate = (req, res, next) => {
  try {
    // Read the "Authorization: Bearer <token>" header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please log in first.',
      });
    }

    // Extract the token string
    const token = authHeader.split(' ')[1];

    // Verify token signature & expiration
    const decoded = verifyToken(token);

    // Attach logged-in user data to request object (ensuring both _id and id are accessible)
    req.user = {
      ...decoded,
      _id: decoded.id || decoded._id,
      id: decoded.id || decoded._id,
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};

// ── 4. Simple role-based authorization helper ───────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action.',
    });
  };
};

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  authorize,
  JWT_SECRET,
};

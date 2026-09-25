const User = require('../../models/User');
const { generateToken } = require('../../middlewares/auth');
const { isDBConnected } = require('../../config/db');

class AuthController {
  // ── Register a new account ──────────────────────────────────────────────────
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      // 1. Basic validation
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please fill in all fields (name, email, password)',
        });
      }

      // 2. Check DB connection status
      if (!isDBConnected()) {
        return res.status(503).json({
          success: false,
          message: 'Database connection is unavailable. Please check your MONGO_URI in backend/.env or ensure MongoDB is running.',
        });
      }

      // 3. Check if user already exists
      const cleanEmail = email.toLowerCase().trim();
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists',
        });
      }

      // 4. Create user in database (password is automatically hashed by User model)
      const user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        password,
      });

      // 5. Generate JWT token
      const token = generateToken(user._id.toString(), user.email);

      // 6. Send response with token & user info
      return res.status(201).json({
        success: true,
        message: 'Account created successfully',
        token,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      const isDbError = error.message && (error.message.includes('initial connection is complete') || error.message.includes('bufferCommands'));
      return res.status(500).json({
        success: false,
        message: isDbError
          ? 'Database connection is unavailable. Please check your MONGO_URI in backend/.env or ensure MongoDB is running.'
          : error.message || 'Server error during registration',
      });
    }
  }

  // ── Log in to existing account ─────────────────────────────────────────────
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // 1. Basic validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please enter both email and password',
        });
      }

      // 2. Check DB connection status
      if (!isDBConnected()) {
        return res.status(503).json({
          success: false,
          message: 'Database connection is unavailable. Please check your MONGO_URI in backend/.env or ensure MongoDB is running.',
        });
      }

      // 3. Find user by email (include password for checking)
      const cleanEmail = email.toLowerCase().trim();
      const user = await User.findOne({ email: cleanEmail }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // 4. Compare password with stored hash
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // 5. Generate JWT token
      const token = generateToken(user._id.toString(), user.email);

      // 6. Send response with token & user info
      return res.status(200).json({
        success: true,
        message: 'Logged in successfully',
        token,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      const isDbError = error.message && (error.message.includes('initial connection is complete') || error.message.includes('bufferCommands'));
      return res.status(500).json({
        success: false,
        message: isDbError
          ? 'Database connection is unavailable. Please check your MONGO_URI in backend/.env or ensure MongoDB is running.'
          : error.message || 'Server error during login',
      });
    }
  }

  // ── Get profile of current logged in user ─────────────────────────────────
  async getMe(req, res) {
    try {
      const fallbackUser = {
        id: req.user.id || req.user._id,
        _id: req.user.id || req.user._id,
        name: req.user.name || req.user.email?.split('@')[0] || 'User',
        email: req.user.email,
        role: req.user.role || 'admin',
      };

      if (!isDBConnected()) {
        return res.status(200).json({
          success: true,
          data: { user: fallbackUser },
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(200).json({
          success: true,
          data: { user: fallbackUser },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      const fallbackUser = {
        id: req.user?.id || req.user?._id,
        _id: req.user?.id || req.user?._id,
        name: req.user?.name || req.user?.email?.split('@')[0] || 'User',
        email: req.user?.email,
        role: req.user?.role || 'admin',
      };
      return res.status(200).json({
        success: true,
        data: { user: fallbackUser },
      });
    }
  }
}

module.exports = AuthController;

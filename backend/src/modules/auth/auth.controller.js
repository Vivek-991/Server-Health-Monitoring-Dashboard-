const User = require('../../models/User');
const { generateToken } = require('../../middlewares/auth');

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

      // 2. Check if user already exists
      const cleanEmail = email.toLowerCase().trim();
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists',
        });
      }

      // 3. Create user in database (password is automatically hashed by User model)
      const user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        password,
      });

      // 4. Generate JWT token
      const token = generateToken(user._id.toString(), user.email);

      // 5. Send response with token & user info
      return res.status(201).json({
        success: true,
        message: 'Account created successfully',
        token,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error during registration',
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

      // 2. Find user by email (include password for checking)
      const cleanEmail = email.toLowerCase().trim();
      const user = await User.findOne({ email: cleanEmail }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // 3. Compare password with stored hash
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // 4. Generate JWT token
      const token = generateToken(user._id.toString(), user.email);

      // 5. Send response with token & user info
      return res.status(200).json({
        success: true,
        message: 'Logged in successfully',
        token,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error during login',
      });
    }
  }

  // ── Get profile of current logged in user ─────────────────────────────────
  async getMe(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error',
      });
    }
  }
}

module.exports = AuthController;

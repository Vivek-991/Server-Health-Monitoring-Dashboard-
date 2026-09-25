const User = require('../../models/User');
const { AppError } = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { isDBConnected } = require('../../config/db');

class UsersController {
  // GET /api/users - List all users
  getUsers = async (req, res, next) => {
    try {
      if (!isDBConnected()) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
        });
      }
      const users = await User.find().select('-password').sort({ createdAt: -1 });
      res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    } catch (error) {
      logger.error('getUsers error:', error);
      next(error);
    }
  };

  // POST /api/users - Create new user (Admin)
  createUser = async (req, res, next) => {
    try {
      const { name, email, password, role } = req.body;
      if (!name || !email || !password) {
        throw new AppError('Name, email, and password are required', 400);
      }

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        throw new AppError('Email already registered', 400);
      }

      const newUser = await User.create({
        name,
        email: email.toLowerCase(),
        password,
        role: role || 'viewer',
        isActive: true,
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: newUser,
      });
    } catch (error) {
      logger.error('createUser error:', error);
      next(error);
    }
  };

  // PATCH /api/users/:id - Update user role or active status
  updateUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role, isActive, name } = req.body;

      const user = await User.findById(id);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (role) user.role = role;
      if (typeof isActive === 'boolean') user.isActive = isActive;
      if (name) user.name = name;

      await user.save();

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: user,
      });
    } catch (error) {
      logger.error('updateUser error:', error);
      next(error);
    }
  };

  // DELETE /api/users/:id - Delete user
  deleteUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id || req.user?._id;

      if (id === currentUserId?.toString()) {
        throw new AppError('Cannot delete your own active account', 400);
      }

      const deleted = await User.findByIdAndDelete(id);
      if (!deleted) {
        throw new AppError('User not found', 404);
      }

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      logger.error('deleteUser error:', error);
      next(error);
    }
  };
}

module.exports = new UsersController();

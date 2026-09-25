const Server = require('../../models/Server');
const MetricSnapshot = require('../../models/MetricSnapshot');
const { AppError } = require('../../utils/AppError');
const logger = require('../../utils/logger');
const crypto = require('crypto');

class ServerController {
  generateApiKey() {
    return `shd_${crypto.randomBytes(32).toString('hex')}`;
  }

  async listServers(req, res, next) {
    try {
      const { isDBConnected } = require('../../config/db');
      if (!isDBConnected()) {
        return res.status(200).json({
          success: true,
          count: 0,
          total: 0,
          page: 1,
          pages: 1,
          data: [],
        });
      }
      const { status, page = 1, limit = 20 } = req.query;
      const userId = req.user._id || req.user.id;
      const filter = { user: userId, isActive: true };

      if (status) filter.status = status;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [servers, total] = await Promise.all([
        Server.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        Server.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        count: servers.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        data: servers,
      });
    } catch (error) {
      logger.error('listServers error:', error);
      next(error);
    }
  }

  async getServer(req, res, next) {
    try {
      const userId = req.user._id || req.user.id;
      const server = await Server.findOne({ _id: req.params.id, user: userId });
      if (!server) {
        throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
      }

      const latestSnapshot = await MetricSnapshot.findOne({ server: server._id })
        .sort({ timestamp: -1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          ...server.toJSON(),
          latestMetrics: latestSnapshot || null,
        },
      });
    } catch (error) {
      logger.error('getServer error:', error);
      next(error);
    }
  }

  async createServer(req, res, next) {
    try {
      const { name, hostname, ip, tags } = req.body;

      const server = await Server.create({
        user: req.user._id || req.user.id,
        name,
        hostname: hostname || '',
        ip: ip || '',
        tags: tags || [],
        apiKey: this.generateApiKey(),
      });

      res.status(201).json({ success: true, data: server.toJSON() });
    } catch (error) {
      logger.error('createServer error:', error);
      next(error);
    }
  }

  async updateServer(req, res, next) {
    try {
      const allowedFields = ['name', 'hostname', 'ip', 'tags'];
      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      const server = await Server.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id || req.user.id },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!server) {
        throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
      }

      res.status(200).json({ success: true, data: server.toJSON() });
    } catch (error) {
      logger.error('updateServer error:', error);
      next(error);
    }
  }

  async deleteServer(req, res, next) {
    try {
      const server = await Server.findOneAndDelete({ _id: req.params.id, user: req.user._id || req.user.id });
      if (!server) {
        throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
      }

      await MetricSnapshot.deleteMany({ server: server._id });

      res.status(200).json({ success: true, message: 'Server deleted successfully' });
    } catch (error) {
      logger.error('deleteServer error:', error);
      next(error);
    }
  }

  async regenerateApiKey(req, res, next) {
    try {
      const newKey = this.generateApiKey();
      const server = await Server.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id || req.user.id },
        { $set: { apiKey: newKey } },
        { new: true }
      );

      if (!server) {
        throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
      }

      res.status(200).json({ success: true, data: { apiKey: newKey } });
    } catch (error) {
      logger.error('regenerateApiKey error:', error);
      next(error);
    }
  }

  async getServerMetricsHistory(req, res, next) {
    try {
      const server = await Server.findOne({ _id: req.params.id, user: req.user._id || req.user.id });
      if (!server) {
        throw new AppError('Server not found', 404, 'SERVER_NOT_FOUND');
      }

      const limit = Math.min(parseInt(req.query.limit) || 60, 500);
      const snapshots = await MetricSnapshot.find({ server: server._id })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      res.status(200).json({ success: true, count: snapshots.length, data: snapshots.reverse() });
    } catch (error) {
      logger.error('getServerMetricsHistory error:', error);
      next(error);
    }
  }
}

module.exports = ServerController;

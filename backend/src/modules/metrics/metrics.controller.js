const { collectMetrics } = require('../../services/systemMetrics');
const MetricSnapshot = require('../../models/MetricSnapshot');
const Server = require('../../models/Server');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/AppError');
const { isDBConnected } = require('../../config/db');

// ── Singleton shared state ────────────────────────────────────────────────────
// One Map shared by BOTH the HTTP route and WebSocket code.
// Key: serverId (string), Value: agent payload object
const activeAgents = new Map();

class MetricsController {
  // Expose the shared map so sockets can read it
  get activeAgents() {
    return activeAgents;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  getAgentsForUser(userId) {
    const result = {};
    for (const [serverId, agent] of activeAgents) {
      if (agent.userId && agent.userId === userId) {
        result[serverId] = agent;
      }
    }
    return result;
  }

  async getAgentsForUserAsync(userId) {
    const result = {};
    if (!userId) return result;

    // 1. Load persistent DB servers for this user so stopped servers remain visible as OFFLINE
    if (isDBConnected()) {
      try {
        const dbServers = await Server.find({ user: userId }).lean();
        dbServers.forEach((srv) => {
          const sId = srv.serverId || srv._id.toString();
          const lastUpdate = srv.lastSeen || srv.updatedAt || srv.createdAt;
          const ageMs = lastUpdate ? Date.now() - new Date(lastUpdate).getTime() : Number.POSITIVE_INFINITY;
          const status = ageMs > 15000 ? 'offline' : (srv.status || 'offline');

          result[sId] = {
            id: sId,
            dbId: srv._id.toString(),
            name: srv.name,
            hostname: srv.hostname || srv.name,
            ip: srv.ip || '—',
            os: { distro: srv.metadata?.os || 'Linux' },
            status,
            lastSeen: lastUpdate ? new Date(lastUpdate).toISOString() : new Date().toISOString(),
            timestamp: lastUpdate ? new Date(lastUpdate).toISOString() : new Date().toISOString(),
            cpu: srv.metadata?.cpu || { usage: 0, model: 'EC2 Instance', cores: 1 },
            memory: { total: srv.metadata?.memory?.total || 0, used: 0, free: 0, usagePercent: 0 },
            disks: [],
            network: {},
            load: {},
            services: [],
          };
        });
      } catch (err) {
        logger.warn('Failed to load DB servers for agents:', err.message);
      }
    }

    // 2. Overlay live active agents from in-memory activeAgents Map
    for (const [serverId, agent] of activeAgents) {
      if (agent.userId && agent.userId === userId) {
        const matchKey = Object.keys(result).find(
          (k) => k === serverId || result[k].dbId === serverId || result[k].name === agent.name
        );
        const targetKey = matchKey || serverId;
        result[targetKey] = {
          ...result[targetKey],
          ...agent,
          id: targetKey,
        };
      }
    }

    return result;
  }

  async emitAgentUpdates(io) {
    if (!io) return;
    const sockets = Array.from(io.sockets.sockets.values());
    for (const socket of sockets) {
      const userId = socket.data?.userId;
      if (userId) {
        const userAgents = await this.getAgentsForUserAsync(userId);
        socket.emit('metrics:update:agents', userAgents);
      }
    }
  }

  // ── Controllers ──────────────────────────────────────────────────────────
  getLiveMetrics = async (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Local host monitoring disabled. Connect external servers via agent.py',
      data: null,
    });
  };

  getHistoricalMetrics = async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 60, 500);
      const userId = req.user?._id || req.user?.id;
      const { serverId } = req.query;

      const filter = {};
      if (userId) filter.user = userId;
      if (serverId) filter.serverId = serverId;

      const snapshots = await MetricSnapshot.find(filter)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      res.status(200).json({ success: true, count: snapshots.length, data: snapshots.reverse() });
    } catch (error) {
      logger.error('getHistoricalMetrics error:', error);
      next(error);
    }
  };

  getServerStatus = async (_req, res) => {
    res.status(200).json({
      success: true,
      status: 'online',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * POST /api/metrics/push
   * Called by agent.py running on a remote server.
   * Validates the per-server apiKey against the DB → guarantees per-user isolation.
   */
  pushAgentMetrics = async (req, res, next) => {
    try {
      const { serverId, apiKey, metrics } = req.body;

      if (!serverId || !apiKey || !metrics) {
        throw new AppError('Missing serverId, apiKey or metrics payload.', 400, 'MISSING_FIELDS');
      }

      // ── Validate apiKey against DB (per-user isolation) ─────────────────
      let ownerUserId = null;
      let dbServer = null;

      if (isDBConnected()) {
        // Each server in the DB has its own unique apiKey generated at creation
        dbServer = await Server.findOne({ apiKey }).select('+apiKey user');
        if (!dbServer) {
          // Fall back: accept the legacy global key only in development
          const globalKey = process.env.AGENT_API_KEY || 'default-secure-key-123';
          if (apiKey !== globalKey) {
            throw new AppError('Invalid API key. Please use the per-server key from your dashboard.', 401, 'INVALID_API_KEY');
          }
          // Legacy: no user isolation
          logger.warn(`Agent "${serverId}" using global API key — no user isolation`);
        } else {
          ownerUserId = dbServer.user?.toString();
        }
      } else {
        // DB offline: accept legacy global key only
        const globalKey = process.env.AGENT_API_KEY || 'default-secure-key-123';
        if (apiKey !== globalKey) {
          throw new AppError('Invalid API key.', 401, 'INVALID_API_KEY');
        }
      }

      const now = new Date().toISOString();

      const payload = {
        ...metrics,
        id: serverId,
        name: dbServer?.name || serverId,
        userId: ownerUserId,
        hostname: metrics.hostname || serverId,
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        status: metrics.status || 'online',
        timestamp: now,
        lastSeen: now,
      };

      activeAgents.set(serverId, payload);

      // ── Persist snapshot to DB ────────────────────────────────────────────
      if (isDBConnected() && ownerUserId) {
        const snapshot = {
          user: ownerUserId,
          serverId,
          cpu: metrics.cpu,
          memory: metrics.memory,
          disk: metrics.disks,
          network: metrics.network,
          uptime: metrics.os?.uptime,
          temperature: metrics.temperatures?.[0] ? { main: metrics.temperatures[0].main } : undefined,
          load: metrics.load,
          services: metrics.services,
          status: metrics.status || 'online',
        };
        if (dbServer) snapshot.server = dbServer._id;

        MetricSnapshot.create(snapshot).catch((err) =>
          logger.warn('Snapshot save failed:', err.message)
        );

        // Update server status and lastSeen
        if (dbServer) {
          Server.findByIdAndUpdate(dbServer._id, {
            status: metrics.status || 'online',
            lastSeen: new Date(),
            'metadata.cpu': metrics.cpu
              ? { model: metrics.cpu.model, cores: metrics.cpu.cores, speed: metrics.cpu.speed }
              : undefined,
            'metadata.memory': metrics.memory ? { total: metrics.memory.total } : undefined,
            'metadata.os': metrics.os?.distro || metrics.hostname,
          }).catch((err) => logger.warn('Server status update failed:', err.message));
        }
      }

      // ── Threshold checks for alerts ──────────────────────────────────────
      const cpuUsage = metrics.cpu?.usage ?? 0;
      const memUsage = metrics.memory?.usagePercent ?? 0;
      const primaryDiskUsage = metrics.disks?.[0]?.usagePercent ?? metrics.disk?.[0]?.usagePercent ?? 0;

      if (cpuUsage >= 90 || memUsage >= 95 || primaryDiskUsage >= 95) {
        const sName = dbServer?.name || serverId;
        const alertMsg = `Critical Resource Alert on server "${sName}": CPU ${cpuUsage.toFixed(1)}%, RAM ${memUsage.toFixed(1)}%, Disk ${primaryDiskUsage.toFixed(1)}%`;
        try {
          const { sendEmailAlert } = require('../../services/emailService');
          sendEmailAlert(`Critical Threshold Alert: ${sName}`, alertMsg).catch(() => {});
        } catch {
          // ignore email service load error
        }
      }

      // ── Broadcast via WebSocket ───────────────────────────────────────────
      const io = req.app.get('socketio');
      this.emitAgentUpdates(io);

      res.status(200).json({ success: true, message: 'Metrics received successfully.' });
    } catch (error) {
      logger.error('pushAgentMetrics error:', error);
      next(error);
    }
  };

  getAgentServers = async (req, res, next) => {
    try {
      const userId = (req.user?._id || req.user?.id)?.toString();
      const agents = await this.getAgentsForUserAsync(userId);
      res.status(200).json({
        success: true,
        agents,
      });
    } catch (error) {
      logger.error('getAgentServers error:', error);
      next(error);
    }
  };

  removeAgentServer = async (req, res, next) => {
    try {
      const { serverId } = req.params;
      const userId = (req.user?._id || req.user?.id)?.toString();

      if (!serverId) {
        throw new AppError('Missing serverId parameter.', 400, 'MISSING_SERVER_ID');
      }

      // Remove from in-memory activeAgents map
      activeAgents.delete(serverId);

      // Remove from MongoDB Server collection
      if (isDBConnected()) {
        const query = { user: userId };
        const isMongoId = /^[0-9a-fA-F]{24}$/.test(serverId);
        if (isMongoId) {
          query.$or = [{ _id: serverId }, { serverId }, { name: serverId }];
        } else {
          query.$or = [{ serverId }, { name: serverId }];
        }
        await Server.deleteMany(query).catch((err) => logger.warn('DB server delete warning:', err.message));
      }

      const io = req.app.get('socketio');
      await this.emitAgentUpdates(io);
      return res.status(200).json({ success: true, message: `Server ${serverId} removed.` });
    } catch (error) {
      logger.error('removeAgentServer error:', error);
      next(error);
    }
  };

  removeAllAgentServers = async (req, res, next) => {
    try {
      const userId = (req.user?._id || req.user?.id)?.toString();

      for (const [key, agent] of activeAgents) {
        if (agent.userId === userId) {
          activeAgents.delete(key);
        }
      }

      const io = req.app.get('socketio');
      this.emitAgentUpdates(io);

      return res.status(200).json({ success: true, message: 'All your servers removed.' });
    } catch (error) {
      logger.error('removeAllAgentServers error:', error);
      next(error);
    }
  };
}

// Export a singleton instance so route + socket share same state
const metricsControllerInstance = new MetricsController();
module.exports = metricsControllerInstance;

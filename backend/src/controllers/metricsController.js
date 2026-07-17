const { collectMetrics } = require('../services/systemMetrics');
const MetricSnapshot = require('../models/MetricSnapshot');
const logger = require('../utils/logger');

// In-memory store for active remote server agents
const activeAgents = {};

/**
 * GET /api/metrics/live
 * Returns the current snapshot of system metrics (no DB write).
 */
const getLiveMetrics = async (req, res, next) => {
  try {
    const metrics = await collectMetrics();
    res.status(200).json({ success: true, data: metrics });
  } catch (error) {
    logger.error('getLiveMetrics error:', error);
    next(error);
  }
};

/**
 * GET /api/metrics/history?limit=60
 * Returns historical snapshots stored in MongoDB.
 */
const getHistoricalMetrics = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 60;
    const snapshots = await MetricSnapshot.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.status(200).json({ success: true, count: snapshots.length, data: snapshots.reverse() });
  } catch (error) {
    logger.error('getHistoricalMetrics error:', error);
    next(error);
  }
};

/**
 * GET /api/metrics/status
 * Quick health check endpoint.
 */
const getServerStatus = async (req, res) => {
  res.status(200).json({
    success: true,
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

/**
 * POST /api/metrics/push
 * Receives remote diagnostics pushed from agent script.
 */
const pushAgentMetrics = async (req, res, next) => {
  try {
    const { serverId, apiKey, metrics } = req.body;

    if (!serverId || !apiKey || !metrics) {
      return res.status(400).json({ success: false, message: 'Missing serverId, apiKey or metrics payload.' });
    }

    // Verify key
    const systemKey = process.env.AGENT_API_KEY || 'default-secure-key-123';
    if (apiKey !== systemKey) {
      return res.status(401).json({ success: false, message: 'Unauthorized API key.' });
    }

    const payload = {
      ...metrics,
      id: serverId,
      name: serverId,
      hostname: metrics.hostname || serverId,
      ip: req.ip || '127.0.0.1',
      status: metrics.status || 'online',
      timestamp: new Date().toISOString()
    };

    // Cache latest status
    activeAgents[serverId] = payload;

    // Broadcast update via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('metrics:update:agents', activeAgents);
    }

    res.status(200).json({ success: true, message: 'Agent metrics recorded successfully.' });
  } catch (error) {
    logger.error('pushAgentMetrics error:', error);
    next(error);
  }
};

/**
 * GET /api/metrics/agents
 * Retrieves the current state of all active server agents.
 */
const getAgentServers = async (req, res) => {
  res.status(200).json({
    success: true,
    agents: activeAgents
  });
};

/**
 * DELETE /api/metrics/agents/:serverId
 * Removes a remote server agent from the active agents list.
 */
const removeAgentServer = async (req, res, next) => {
  try {
    const { serverId } = req.params;

    if (!serverId) {
      return res.status(400).json({ success: false, message: 'Missing serverId parameter.' });
    }

    if (activeAgents[serverId]) {
      delete activeAgents[serverId];
      
      // Broadcast updated list to all Socket.IO clients
      const io = req.app.get('socketio');
      if (io) {
        io.emit('metrics:update:agents', activeAgents);
      }

      return res.status(200).json({ success: true, message: `Server ${serverId} removed successfully.` });
    } else {
      return res.status(404).json({ success: false, message: `Server ${serverId} not found.` });
    }
  } catch (error) {
    logger.error('removeAgentServer error:', error);
    next(error);
  }
};

module.exports = {
  getLiveMetrics,
  getHistoricalMetrics,
  getServerStatus,
  pushAgentMetrics,
  getAgentServers,
  removeAgentServer,
  activeAgents
};

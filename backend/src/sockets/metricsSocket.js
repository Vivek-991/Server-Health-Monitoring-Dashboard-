const logger = require('../utils/logger');
const { sendEmailAlert } = require('../services/emailService');
const { verifyToken } = require('../middlewares/auth');
const metricsController = require('../modules/metrics/metrics.controller');
const { EMIT_INTERVAL_MS, EMAIL_COOLDOWN_MS, AGENT_OFFLINE_MS } = require('../utils/constants');

const initMetricsSocket = (io) => {
  // ── Optional Socket Auth ───────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token) {
        const decoded = verifyToken(token);
        socket.data.userId = decoded.id;
      } else {
        socket.data.userId = null;
      }
      next();
    } catch {
      socket.data.userId = null;
      next();
    }
  });

  // ── Remote Server Agents Monitoring Loop ───────────────────────────────────
  // Monitors ONLY remote external servers (e.g. AWS EC2, VPS) connected via agent.py.
  // Local host PC metrics are NOT collected or broadcast.
  const broadcastAgentMetrics = async () => {
    try {
      const now = Date.now();
      let agentsChanged = false;

      for (const [serverId, agent] of metricsController.activeAgents) {
        // Check for agent timeout
        if (agent.status !== 'offline') {
          const lastUpdate = new Date(agent.timestamp).getTime();
          if (now - lastUpdate > AGENT_OFFLINE_MS) {
            agent.status = 'offline';
            agent.lastSeen = agent.lastSeen || agent.timestamp;
            agentsChanged = true;
            logger.warn(`Remote server "${serverId}" timed out — marked offline.`);

            sendEmailAlert(
              `Server Offline Alert: ${serverId}`,
              `Warning: Remote agent on "${serverId}" (${agent.hostname || 'Unknown'}) stopped sending metrics.\nLast Heartbeat: ${agent.timestamp}`
            ).catch((err) => logger.error(`Offline alert error for ${serverId}:`, err.message));
          }
        }
      }

      // Always broadcast user-specific remote server updates to authenticated sockets
      await metricsController.emitAgentUpdates(io);
    } catch (error) {
      logger.error('Socket agent broadcast error:', error.message);
    }
  };

  setInterval(broadcastAgentMetrics, EMIT_INTERVAL_MS);
  logger.info('Remote server monitoring background loop started (Local host collection disabled)');

  // ── Per-connection handler ────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.data?.userId;
    logger.info(`Socket connected: ${socket.id} (userId: ${userId || 'anonymous'})`);

    // Send this user's remote server agents immediately on connect
    if (userId) {
      metricsController.getAgentsForUserAsync(userId)
        .then((agents) => socket.emit('metrics:update:agents', agents))
        .catch((err) => logger.warn('Socket connect agent fetch error:', err.message));
    }

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { initMetricsSocket };

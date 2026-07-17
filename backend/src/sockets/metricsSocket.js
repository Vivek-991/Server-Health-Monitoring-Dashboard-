const { collectMetrics } = require('../services/systemMetrics');
const MetricSnapshot = require('../models/MetricSnapshot');
const logger = require('../utils/logger');
const { sendEmailAlert } = require('../services/emailService');
const { activeAgents } = require('../controllers/metricsController');

const EMIT_INTERVAL_MS = 2000; // broadcast every 2 seconds
const EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

let lastCpuAlertTime = 0;

/**
 * Initialise Socket.IO handlers and start the metrics broadcast loop.
 * @param {import('socket.io').Server} io
 */
const initMetricsSocket = (io) => {
  const broadcastMetrics = async () => {
    try {
      const metrics = await collectMetrics();

      // CPU Threshold alert check
      if (metrics.cpu && metrics.cpu.usage >= 90) {
        const now = Date.now();
        if (now - lastCpuAlertTime > EMAIL_COOLDOWN_MS) {
          lastCpuAlertTime = now;
          logger.warn(`CPU alert triggered: ${metrics.cpu.usage}%`);
          
          sendEmailAlert(
            'CPU Usage Critical Alert',
            `Critical warning: CPU usage is at ${metrics.cpu.usage.toFixed(1)}%, exceeding the critical 90% monitoring threshold.\n\nServer Model: ${metrics.cpu.model || 'Unknown'}\nCores: ${metrics.cpu.cores}\nTimestamp: ${new Date().toISOString()}`
          ).catch((err) => logger.error('Email alert trigger error:', err.message));
        }
      }

      // Check for inactive agent servers (timeout after 15 seconds)
      const TIMEOUT_MS = 15000;
      const now = Date.now();
      let agentsChanged = false;

      Object.keys(activeAgents).forEach((serverId) => {
        const agent = activeAgents[serverId];
        if (agent.status !== 'offline') {
          const lastUpdate = new Date(agent.timestamp).getTime();
          if (now - lastUpdate > TIMEOUT_MS) {
            agent.status = 'offline';
            agentsChanged = true;
            logger.warn(`Agent "${serverId}" has timed out and is now offline.`);
            
            // Send email alert for offline status
            sendEmailAlert(
              `Server Offline Alert: ${serverId}`,
              `Warning: The remote monitoring agent on server "${serverId}" (${agent.hostname || 'Unknown'}, IP: ${agent.ip || 'Unknown'}) has stopped sending metrics. It has been marked as OFFLINE.\n\nLast Heartbeat: ${agent.timestamp}\nTimestamp: ${new Date().toISOString()}`
            ).catch((err) => logger.error(`Email alert trigger error for offline server ${serverId}:`, err.message));
          }
        }
      });

      if (agentsChanged) {
        io.emit('metrics:update:agents', activeAgents);
      }

      // Persist snapshot to MongoDB (fire-and-forget, non-fatal)
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          MetricSnapshot.create(metrics).catch((err) =>
            logger.warn('Snapshot save failed:', err.message)
          );
        }
      } catch (_) { /* MongoDB offline – skip persistence */ }

      // Emit to all connected clients
      io.emit('metrics:update', metrics);
    } catch (error) {
      logger.error('Socket broadcast error:', error.message);
      io.emit('metrics:error', { message: 'Failed to collect metrics' });
    }
  };

  // Start background monitoring loop immediately and run forever
  const intervalId = setInterval(broadcastMetrics, EMIT_INTERVAL_MS);
  logger.info('Metrics background monitoring loop started');

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Send an immediate snapshot on connect
    broadcastMetrics();

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
};


module.exports = { initMetricsSocket };

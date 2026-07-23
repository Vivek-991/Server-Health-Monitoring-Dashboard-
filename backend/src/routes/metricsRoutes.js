const express = require('express');
const router = express.Router();
const {
  getLiveMetrics,
  getHistoricalMetrics,
  getServerStatus,
  pushAgentMetrics,
  getAgentServers,
  removeAgentServer,
} = require('../controllers/metricsController');

// @route   GET /api/metrics/live
// @desc    Get current system metrics snapshot
// @access  Public
router.get('/live', getLiveMetrics);

// @route   GET /api/metrics/history
// @desc    Get historical metrics from MongoDB
// @access  Public
router.get('/history', getHistoricalMetrics);

// @route   GET /api/metrics/status
// @desc    Quick server health check
// @access  Public
router.get('/status', getServerStatus);

// @route   POST /api/metrics/push
// @desc    Push metrics from remote server agents
// @access  Public
router.post('/push', pushAgentMetrics);

// @route   GET /api/metrics/agents
// @desc    Get all current active remote server agents
// @access  Public
router.get('/agents', getAgentServers);

// @route   DELETE /api/metrics/agents/:serverId
// @desc    Remove an active remote server agent
// @access  Public
router.delete('/agents/:serverId', removeAgentServer);

// @route   DELETE /api/metrics/agents
// @desc    Remove all active remote server agents
// @access  Public
router.delete('/agents', removeAllAgentServers);

module.exports = router;

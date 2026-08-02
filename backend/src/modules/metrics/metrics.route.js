const express = require('express');
const metricsController = require('./metrics.controller'); // singleton instance
const { authenticate } = require('../../middlewares/auth');
const { agentLimiter } = require('../../middlewares/rateLimiter');

const router = express.Router();

// Public routes (no auth) — live snapshot & agent push
router.get('/live', metricsController.getLiveMetrics);
router.get('/status', metricsController.getServerStatus);
router.post('/push', agentLimiter, (req, res, next) => metricsController.pushAgentMetrics(req, res, next));

// Authenticated routes
router.get('/history', authenticate, metricsController.getHistoricalMetrics);
router.get('/agents', authenticate, (req, res) => metricsController.getAgentServers(req, res));
router.delete('/agents/:serverId', authenticate, (req, res, next) => metricsController.removeAgentServer(req, res, next));
router.delete('/agents', authenticate, (req, res, next) => metricsController.removeAllAgentServers(req, res, next));

module.exports = router;

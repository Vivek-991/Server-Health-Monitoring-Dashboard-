const express = require('express');
const AiController = require('./ai.controller');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();
const aiController = new AiController();

// All AI endpoints require authentication
router.use(authenticate);

router.post('/diagnose', (req, res, next) => aiController.diagnose(req, res, next));
router.post('/chat', (req, res, next) => aiController.chat(req, res, next));
router.post('/remediation', (req, res, next) => aiController.remediation(req, res, next));
router.get('/config', (req, res, next) => aiController.getConfig(req, res, next));
router.post('/config', (req, res, next) => aiController.updateConfig(req, res, next));
router.post('/test', (req, res, next) => aiController.testConnection(req, res, next));

module.exports = router;

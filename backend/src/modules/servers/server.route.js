const express = require('express');
const ServerController = require('./server.controller');
const { authenticate } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const { createServerSchema, updateServerSchema } = require('./server.validator');

const router = express.Router();
const serverController = new ServerController();

router.use(authenticate);

router.get('/', (req, res, next) => serverController.listServers(req, res, next));
router.get('/:id', (req, res, next) => serverController.getServer(req, res, next));
router.post('/', validate(createServerSchema), (req, res, next) => serverController.createServer(req, res, next));
router.put('/:id', validate(updateServerSchema), (req, res, next) => serverController.updateServer(req, res, next));
router.delete('/:id', (req, res, next) => serverController.deleteServer(req, res, next));
router.post('/:id/regenerate-key', (req, res, next) => serverController.regenerateApiKey(req, res, next));
router.get('/:id/metrics', (req, res, next) => serverController.getServerMetricsHistory(req, res, next));

module.exports = router;

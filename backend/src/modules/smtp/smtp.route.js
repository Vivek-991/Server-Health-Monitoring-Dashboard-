const express = require('express');
const SmtpController = require('./smtp.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const { updateSmtpSchema } = require('./smtp.validator');

const router = express.Router();
const smtpController = new SmtpController();

router.get('/', authenticate, (req, res, next) => smtpController.getSmtpSettings(req, res, next));
router.post('/', authenticate, authorize('admin', 'editor'), validate(updateSmtpSchema), (req, res, next) => smtpController.updateSmtpSettings(req, res, next));
router.post('/test', authenticate, authorize('admin', 'editor'), (req, res, next) => smtpController.testSmtpSettings(req, res, next));

module.exports = router;

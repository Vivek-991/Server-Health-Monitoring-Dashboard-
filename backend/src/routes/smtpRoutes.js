const express = require('express');
const router = express.Router();
const { getSmtpSettings, updateSmtpSettings } = require('../controllers/smtpController');

// @route   GET /api/smtp
// @desc    Retrieve dynamic SMTP credentials config
// @access  Public (should ideally be protected, but keeping it open for dev flow)
router.get('/', getSmtpSettings);

// @route   POST /api/smtp
// @desc    Save new SMTP credentials config
// @access  Public
router.post('/', updateSmtpSettings);

module.exports = router;

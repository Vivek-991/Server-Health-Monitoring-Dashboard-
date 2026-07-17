const fs = require('fs');
const { CONFIG_PATH, initTransporter } = require('../services/emailService');
const logger = require('../utils/logger');

const getSmtpSettings = (req, res) => {
  try {
    let currentConfig = { host: '', port: 587, user: '', pass: '', from: '', to: '' };
    if (fs.existsSync(CONFIG_PATH)) {
      currentConfig = { ...currentConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
    }

    // Mask password for safety
    const safeConfig = {
      ...currentConfig,
      pass: currentConfig.pass ? '********' : ''
    };

    res.json({ success: true, config: safeConfig });
  } catch (err) {
    logger.error('Error fetching SMTP settings:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch SMTP settings' });
  }
};

const updateSmtpSettings = async (req, res) => {
  try {
    const { host, port, user, pass, from, to } = req.body;

    let existingConfig = {};
    if (fs.existsSync(CONFIG_PATH)) {
      existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }

    // Handle password masking logic
    let finalPassword = pass;
    if (pass === '********') {
      finalPassword = existingConfig.pass || '';
    }

    const newConfig = {
      host: host || '',
      port: parseInt(port || '587'),
      user: user || '',
      pass: finalPassword || '',
      from: from || '',
      to: to || ''
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');

    // Force reload Nodemailer client configuration
    await initTransporter(true);

    logger.info('SMTP config updated successfully via dashboard');
    res.json({ success: true, message: 'SMTP settings updated successfully' });
  } catch (err) {
    logger.error('Error updating SMTP settings:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update SMTP settings' });
  }
};

module.exports = {
  getSmtpSettings,
  updateSmtpSettings
};

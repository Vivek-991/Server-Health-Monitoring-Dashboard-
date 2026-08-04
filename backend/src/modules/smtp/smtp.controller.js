const fs = require('fs');
const path = require('path');
const { CONFIG_PATH, initTransporter } = require('../../services/emailService');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/AppError');

class SmtpController {
  async getSmtpSettings(req, res, next) {
    try {
      let currentConfig = { host: '', port: 587, user: '', pass: '', from: '', to: '' };
      if (fs.existsSync(CONFIG_PATH)) {
        currentConfig = { ...currentConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
      }

      const safeConfig = {
        ...currentConfig,
        pass: currentConfig.pass ? '********' : '',
      };

      res.json({ success: true, config: safeConfig });
    } catch (error) {
      logger.error('Error fetching SMTP settings:', error);
      next(error);
    }
  }

  async updateSmtpSettings(req, res, next) {
    try {
      const { host, port, user, pass, from, to } = req.body;

      let existingConfig = {};
      if (fs.existsSync(CONFIG_PATH)) {
        existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      }

      let finalPassword = pass;
      if (pass === '********') {
        finalPassword = existingConfig.pass || '';
      }

      const newConfig = {
        host: host || '',
        port: parseInt(port || '587', 10),
        user: user || '',
        pass: finalPassword || '',
        from: from || '',
        to: to || '',
      };

      fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
      await initTransporter(true);

      logger.info('SMTP config updated successfully');
      res.json({ success: true, message: 'SMTP settings updated successfully' });
    } catch (error) {
      logger.error('Error updating SMTP settings:', error);
      next(error);
    }
  }

  async testSmtpSettings(req, res, next) {
    try {
      const { sendEmailAlert } = require('../../services/emailService');
      const result = await sendEmailAlert(
        'SMTP Test',
        'This is a test email from MonitorX Dashboard. Your SMTP configuration is working correctly.'
      );

      if (result.success) {
        res.json({ success: true, message: 'Test email sent successfully', previewUrl: result.previewUrl || null });
      } else {
        throw new AppError('Failed to send test email: ' + (result.error || 'Unknown error'), 500, 'SMTP_TEST_FAILED');
      }
    } catch (error) {
      logger.error('Error testing SMTP:', error);
      next(error);
    }
  }
}

module.exports = SmtpController;

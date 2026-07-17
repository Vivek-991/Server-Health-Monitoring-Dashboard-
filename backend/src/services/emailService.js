const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;
let testAccount = null;
const CONFIG_PATH = path.join(__dirname, '../config/smtpConfig.json');

const getSmtpConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (err) {
    logger.error('Error reading SMTP config file:', err.message);
  }
  return {};
};

const initTransporter = async (force = false) => {
  if (transporter && !force) return transporter;

  const fileConfig = getSmtpConfig();

  const host = fileConfig.host || process.env.EMAIL_HOST;
  const port = parseInt(fileConfig.port || process.env.EMAIL_PORT || '587');
  const user = fileConfig.user || process.env.EMAIL_USER;
  const pass = fileConfig.pass || process.env.EMAIL_PASS;

  const isPlaceholder = 
    !user || 
    user.includes('your_email') || 
    !pass || 
    pass.includes('your_app_specific_password');

  if (host && user && pass && !isPlaceholder) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: { user, pass }
    });
    logger.info(`Email transporter initialized for SMTP: ${host}`);
  } else {
    // Dynamic Ethereal test account generation for instant sandbox testing
    try {
      if (!testAccount) {
        logger.info('Generating temporary sandbox account for email testing...');
        testAccount = await nodemailer.createTestAccount();
      }
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      logger.info(`Mailer initialized using sandbox SMTP: smtp.ethereal.email (User: ${testAccount.user})`);
    } catch (err) {
      logger.error('Failed to create test email account:', err.message);
      transporter = null;
    }
  }

  return transporter;
};

/**
 * Send an email alert for metric violations
 * @param {string} subject
 * @param {string} text
 */
const sendEmailAlert = async (subject, text) => {
  const fileConfig = getSmtpConfig();

  const toEmail = fileConfig.to || process.env.EMAIL_TO || 'admin@example.com';
  const fromEmail = fileConfig.from || process.env.EMAIL_FROM || '"ServerPulse Alerts" <alerts@serverpulse.io>';

  const client = await initTransporter();

  const mailOptions = {
    from: fromEmail,
    to: toEmail,
    subject: `🚨 [ALERT] ${subject}`,
    text,
    html: `<div style="font-family: sans-serif; padding: 25px; border-radius: 12px; border: 1px solid #ef4444; background: #fffcfc; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
        <span style="font-size: 28px;">🚨</span>
        <h2 style="color: #ef4444; margin: 0; font-size: 22px; font-weight: 800;">Server Metric Breach</h2>
      </div>
      <p style="font-size: 15px; color: #333; line-height: 1.6; background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #f3f4f6;">
        ${text.replace(/\n/g, '<br>')}
      </p>
      <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #eee; text-align: center;">
        <small style="color: #888; font-size: 11px;">This alert was generated automatically by ServerPulse Health Dashboard.</small>
      </div>
    </div>`
  };

  if (client) {
    try {
      const info = await client.sendMail(mailOptions);
      const testUrl = nodemailer.getTestMessageUrl(info);
      if (testUrl) {
        logger.info('================================================================');
        logger.warn(`📧 Dynamic Alert Sent to Sandbox!`);
        logger.warn(`🔗 Click here to preview your styled email:`);
        logger.warn(`👉 ${testUrl}`);
        logger.info('================================================================');
      } else {
        logger.info(`Email alert sent: ${info.messageId} to ${toEmail}`);
      }
      return { success: true, messageId: info.messageId, previewUrl: testUrl };
    } catch (err) {
      logger.error('Failed to send email alert:', err.message);
      return { success: false, error: err.message };
    }
  } else {
    // Console fallback
    logger.info('╔════════════════ MOCK EMAIL NOTIFICATION ════════════════╗');
    logger.info(`║ TO:      ${toEmail}`);
    logger.info(`║ FROM:    ${fromEmail}`);
    logger.info(`║ SUBJECT: 🚨 [ALERT] ${subject}`);
    logger.info(`║ BODY:    ${text}`);
    logger.info('╚═════════════════════════════════════════════════════════╝');
    return { success: true, mock: true };
  }
};

module.exports = { sendEmailAlert, getSmtpConfig, initTransporter, CONFIG_PATH };

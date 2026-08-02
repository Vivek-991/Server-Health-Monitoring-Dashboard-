const Joi = require('joi');

const updateSmtpSchema = Joi.object({
  host: Joi.string().hostname().allow(''),
  port: Joi.number().integer().min(1).max(65535).default(587),
  user: Joi.string().email().allow(''),
  pass: Joi.string().allow(''),
  from: Joi.string().email().allow(''),
  to: Joi.string().email().allow(''),
});

module.exports = { updateSmtpSchema };

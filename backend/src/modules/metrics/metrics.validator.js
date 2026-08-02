const Joi = require('joi');

const pushMetricsSchema = Joi.object({
  serverId: Joi.string().required().messages({ 'any.required': 'serverId is required' }),
  apiKey: Joi.string().required().messages({ 'any.required': 'apiKey is required' }),
  metrics: Joi.object().required().messages({ 'any.required': 'metrics payload is required' }),
  ownerId: Joi.string().allow(''),
  ownerEmail: Joi.string().email().allow(''),
  ownerName: Joi.string().allow(''),
});

const historyQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(500).default(60),
  serverId: Joi.string().allow(''),
});

module.exports = { pushMetricsSchema, historyQuerySchema };

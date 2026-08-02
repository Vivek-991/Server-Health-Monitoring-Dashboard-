const Joi = require('joi');

const createServerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Server name is required',
    'string.empty': 'Server name cannot be empty',
  }),
  hostname: Joi.string().trim().max(255).allow(''),
  ip: Joi.string().trim().ip().allow(''),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10),
});

const updateServerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  hostname: Joi.string().trim().max(255).allow(''),
  ip: Joi.string().trim().ip().allow(''),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10),
}).min(1);

const listServersQuerySchema = Joi.object({
  status: Joi.string().valid('online', 'offline', 'degraded'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { createServerSchema, updateServerSchema, listServersQuerySchema };

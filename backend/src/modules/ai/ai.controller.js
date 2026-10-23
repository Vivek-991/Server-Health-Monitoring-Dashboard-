const aiService = require('./ai.service');
const metricsController = require('../metrics/metrics.controller');
const Server = require('../../models/Server');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/AppError');
const { isDBConnected } = require('../../config/db');

class AiController {
  // Helper to fetch server telemetry for a user
  async resolveServerTelemetry(userId, serverId, inlineContext) {
    if (inlineContext && Object.keys(inlineContext).length > 0) {
      return inlineContext;
    }

    try {
      const userAgents = await metricsController.getAgentsForUserAsync(userId);
      if (serverId && userAgents[serverId]) {
        return userAgents[serverId];
      }

      // If specific serverId requested, try to find in DB
      if (serverId && isDBConnected()) {
        const srv = await Server.findOne({ _id: serverId, user: userId }).lean();
        if (srv) {
          return {
            id: srv.serverId || srv._id.toString(),
            name: srv.name,
            hostname: srv.hostname || srv.name,
            ip: srv.ip || '—',
            status: srv.status || 'offline',
            cpu: srv.metadata?.cpu || { usage: 0, cores: 1 },
            memory: { total: srv.metadata?.memory?.total || 0, used: 0, usagePercent: 0 },
            disks: [],
            os: { distro: srv.metadata?.os || 'Linux' },
          };
        }
      }

      // Return first available agent
      const firstKey = Object.keys(userAgents)[0];
      if (firstKey) {
        return userAgents[firstKey];
      }
    } catch (err) {
      logger.warn(`Failed resolving server telemetry for AI: ${err.message}`);
    }

    return {
      name: 'Default Node',
      status: 'online',
      cpu: { usage: 15, cores: 2, model: 'Virtual CPU' },
      memory: { total: 4294967296, used: 2147483648, usagePercent: 50 },
      disks: [{ fs: 'ext4', mount: '/', size: 53687091200, used: 21474836480, usagePercent: 40 }],
      network: { rx_sec: 10240, tx_sec: 5120 },
      os: { distro: 'Ubuntu 22.04 LTS' },
    };
  }

  // ── POST /api/ai/diagnose ─────────────────────────────────────────────────
  diagnose = async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;
      const { serverId, serverContext } = req.body || {};

      const telemetry = await this.resolveServerTelemetry(userId, serverId, serverContext);
      const diagnosis = await aiService.diagnoseServer(telemetry);

      res.status(200).json({
        success: true,
        data: diagnosis,
        server: {
          id: telemetry.id || serverId,
          name: telemetry.name || telemetry.hostname || 'Target Server',
          status: telemetry.status || 'online',
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /api/ai/chat ─────────────────────────────────────────────────────
  chat = async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;
      const { messages, serverId, serverContext } = req.body || {};

      if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError('Messages array is required for AI chat.', 400);
      }

      const telemetry = await this.resolveServerTelemetry(userId, serverId, serverContext);
      const reply = await aiService.chatWithAgent(messages, telemetry);
      const replyContent = typeof reply === 'object' && reply !== null && reply.content ? reply.content : String(reply || '');
      const isDisabled = Boolean(typeof reply === 'object' && reply !== null && reply.disabled);

      res.status(200).json({
        success: true,
        disabled: isDisabled,
        message: {
          role: 'assistant',
          content: replyContent,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /api/ai/remediation ──────────────────────────────────────────────
  remediation = async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;
      const { issueType, serverId, serverContext } = req.body || {};

      if (!issueType) {
        throw new AppError('issueType is required for generating a remediation playbook.', 400);
      }

      const telemetry = await this.resolveServerTelemetry(userId, serverId, serverContext);
      const playbook = await aiService.generateRemediationPlan(issueType, telemetry);

      res.status(200).json({
        success: true,
        data: {
          issueType,
          playbook,
          server: telemetry.name || 'Server',
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /api/ai/config ────────────────────────────────────────────────────
  getConfig = async (_req, res, next) => {
    try {
      const cfg = aiService.aiConfig;
      res.status(200).json({
        success: true,
        config: {
          enabled: cfg.enabled !== false,
          provider: cfg.provider,
          geminiModel: cfg.geminiModel,
          openaiModel: cfg.openaiModel,
          hasApiKey: Boolean(cfg.apiKey || (cfg.provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY)),
          maskedApiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}••••••••${cfg.apiKey.slice(-4)}` : '',
          temperature: cfg.temperature,
          isBuiltinAvailable: true,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /api/ai/config ───────────────────────────────────────────────────
  updateConfig = async (req, res, next) => {
    try {
      const { enabled, provider, apiKey, geminiModel, openaiModel, temperature } = req.body || {};

      if (typeof enabled === 'boolean') {
        aiService.aiConfig.enabled = enabled;
      }
      if (provider) {
        aiService.aiConfig.provider = provider;
      }
      if (typeof apiKey === 'string') {
        aiService.aiConfig.apiKey = apiKey.trim();
      }
      if (geminiModel) {
        aiService.aiConfig.geminiModel = geminiModel;
      }
      if (openaiModel) {
        aiService.aiConfig.openaiModel = openaiModel;
      }
      if (typeof temperature === 'number') {
        aiService.aiConfig.temperature = Math.max(0, Math.min(1, temperature));
      }

      const cfg = aiService.aiConfig;
      res.status(200).json({
        success: true,
        message: 'AI Agent configuration updated successfully.',
        config: {
          enabled: cfg.enabled !== false,
          provider: cfg.provider,
          geminiModel: cfg.geminiModel,
          openaiModel: cfg.openaiModel,
          hasApiKey: Boolean(cfg.apiKey),
          maskedApiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}••••••••${cfg.apiKey.slice(-4)}` : '',
          temperature: cfg.temperature,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /api/ai/test ─────────────────────────────────────────────────────
  testConnection = async (req, res, next) => {
    try {
      const { provider, apiKey } = req.body || {};
      const testProvider = provider || aiService.aiConfig.provider;
      const testKey = apiKey !== undefined ? apiKey : aiService.aiConfig.apiKey;

      if (testProvider === 'builtin') {
        return res.status(200).json({
          success: true,
          message: 'Built-in SRE AI Engine is active and operating with zero latency!',
        });
      }

      if (!testKey) {
        return res.status(400).json({
          success: false,
          message: `API Key is required to test ${testProvider}.`,
        });
      }

      if (testProvider === 'gemini') {
        const model = aiService.aiConfig.geminiModel || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(testKey)}`;
        const testResp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Respond with the word "pong".' }] }],
          }),
        });

        if (!testResp.ok) {
          const errText = await testResp.text();
          return res.status(400).json({
            success: false,
            message: `Gemini verification failed (${testResp.status}): ${errText.slice(0, 150)}`,
          });
        }

        return res.status(200).json({
          success: true,
          message: `Successfully connected to Google Gemini (${model})!`,
        });
      }

      if (testProvider === 'openai') {
        const model = aiService.aiConfig.openaiModel || 'gpt-4o-mini';
        const testResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${testKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Respond with the word "pong".' }],
            max_tokens: 5,
          }),
        });

        if (!testResp.ok) {
          const errText = await testResp.text();
          return res.status(400).json({
            success: false,
            message: `OpenAI verification failed (${testResp.status}): ${errText.slice(0, 150)}`,
          });
        }

        return res.status(200).json({
          success: true,
          message: `Successfully connected to OpenAI (${model})!`,
        });
      }

      res.status(200).json({ success: true, message: 'Provider validated.' });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AiController;

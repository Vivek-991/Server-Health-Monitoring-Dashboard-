const ROLES = Object.freeze({
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
});

const SERVER_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  DEGRADED: 'degraded',
});

const AGENT_OFFLINE_MS = 15000;
const EMIT_INTERVAL_MS = 2000;
const EMAIL_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_HISTORY_POINTS = 60;

module.exports = {
  ROLES,
  SERVER_STATUS,
  AGENT_OFFLINE_MS,
  EMIT_INTERVAL_MS,
  EMAIL_COOLDOWN_MS,
  MAX_HISTORY_POINTS,
};

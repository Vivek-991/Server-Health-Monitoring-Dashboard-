require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./src/config/db');
const app = require('./src/app');
const { initMetricsSocket } = require('./src/sockets/metricsSocket');
const logger = require('./src/utils/logger');

const httpServer = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const getAllowedOrigins = () => {
  const origins = [];
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3002');
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3002');
  }
  if (process.env.CLIENT_URL) {
    process.env.CLIENT_URL.split(',').forEach((u) => origins.push(u.trim()));
  }
  return origins;
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = getAllowedOrigins();
      if (
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        allowed.includes(origin) ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Socket CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set('socketio', io);

// ── DB + Services ─────────────────────────────────────────────────────────────
connectDB();
initMetricsSocket(io);

const { initTransporter } = require('./src/services/emailService');
initTransporter().catch((err) => logger.error('Failed to initialize email transporter:', err.message));

// ── Listen ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  logger.info(`Client expected at: ${process.env.CLIENT_URL || 'http://localhost:3002'}`);
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is already in use.`);
    logger.error(`   Kill the process with: npx kill-port ${PORT}`);
    logger.error(`   Or on Windows:  netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F`);
    process.exit(1);
  } else {
    throw err;
  }
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM — shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, io };

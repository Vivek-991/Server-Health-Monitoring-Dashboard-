require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const connectDB = require('./src/config/db');
const metricsRoutes = require('./src/routes/metricsRoutes');
const smtpRoutes = require('./src/routes/smtpRoutes');
const { initMetricsSocket } = require('./src/sockets/metricsSocket');
const errorHandler = require('./src/middlewares/errorHandler');
const logger = require('./src/utils/logger');

// ── Bootstrap ────────────────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_URL,
    ].filter(Boolean);

    if (
      !origin ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
});

app.set('socketio', io);


// ── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  logger.debug(`→ ${req.method} ${req.originalUrl}`);
  next();
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/metrics', metricsRoutes);
app.use('/api/smtp', smtpRoutes);


// Root health ping
app.get('/', (_req, res) => {
  res.json({ message: 'Server Health API is running 🚀', timestamp: new Date() });
});

// Serve the agent.py script for client downloads
app.get('/agent.py', (_req, res) => {
  res.download(path.join(__dirname, 'agent.py'), 'agent.py');
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Socket.IO ────────────────────────────────────────────────────────────────
initMetricsSocket(io);

// Initialize email transporter on boot
const { initTransporter } = require('./src/services/emailService');
initTransporter().catch((err) => logger.error('Failed to initialize transporter on boot:', err.message));

// ── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT} [${process.env.NODE_ENV}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, io };

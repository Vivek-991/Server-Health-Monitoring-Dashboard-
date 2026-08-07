const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');

const authRoutes = require('./modules/auth/auth.route');
const metricsRoutes = require('./modules/metrics/metrics.route');
const serverRoutes = require('./modules/servers/server.route');
const smtpRoutes = require('./modules/smtp/smtp.route');
const usersRoutes = require('./modules/users/users.route');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');
const logger = require('./utils/logger');

const app = express();

// Trust reverse proxy headers (Render, Vercel, Nginx, Cloudflare) for accurate client IP rate limiting
app.set('trust proxy', 1);

app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const getAllowedOrigins = () => {
  const origins = [];
  // Always allow localhost in any form (dev)
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3002');
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3002');
    origins.push('http://127.0.0.1:3000');
  }
  // Allow configured client URL(s)
  if (process.env.CLIENT_URL) {
    process.env.CLIENT_URL.split(',').forEach((u) => origins.push(u.trim()));
  }
  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and configured origins
    if (!origin) return callback(null, true);

    const allowed = getAllowedOrigins();
    // In dev allow all localhost origins
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /\.vercel\.app$/.test(origin) ||
      /\.onrender\.com$/.test(origin) ||
      allowed.includes(origin) ||
      allowed.includes('*')
    ) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== 'production') {
      // In dev be permissive — allow any origin
      return callback(null, true);
    }

    // In production — reject unknown origins
    logger.warn(`CORS blocked: ${origin}`);
    return callback(new Error(`CORS: origin ${origin} not allowed`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email', 'x-user-name'],
};

app.use(cors(corsOptions));
app.options('/{*path}', cors(corsOptions)); // Handle preflight (Express 5 syntax)

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── API Rate Limiting ─────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/users', usersRoutes);

// ── Agent script download ─────────────────────────────────────────────────────
app.get('/agent.py', (_req, res) => {
  res.download(path.join(__dirname, '../agent.py'), 'agent.py');
});

// ── Install scripts ───────────────────────────────────────────────────────────
// Quick one-liner shell installer: curl https://your-host/install.sh | bash
app.get('/install.sh', (req, res) => {
  const host = process.env.DASHBOARD_URL || `${req.protocol}://${req.get('host')}`;
  const script = `#!/bin/bash
set -e
echo "================================================"
echo "  MonitorX Agent Installer & Auto-Start Service"
echo "================================================"

# Install Python3 & dependencies safely (supports Ubuntu 24.04 PEP 668)
if command -v apt-get &>/dev/null; then
  echo "Installing Python3 and dependencies via apt..."
  sudo apt-get update -qq && sudo apt-get install -y python3 python3-pip python3-psutil python3-requests
else
  pip3 install --break-system-packages -q psutil requests 2>/dev/null || pip3 install -q psutil requests
fi

# Download agent
mkdir -p /opt
curl -fsSL "${host}/agent.py" -o /opt/monitorx-agent.py

# If environment variables are provided, configure Systemd service for Auto-Start on Reboot
if [ -n "$SERVERPULSE_ID" ] && [ -n "$SERVERPULSE_KEY" ]; then
  URL="\${SERVERPULSE_URL:-${host}/api/metrics/push}"
  echo "Setting up systemd background service (Auto-start on boot)..."
  cat << EOF | sudo tee /etc/systemd/system/monitorx-agent.service > /dev/null
[Unit]
Description=MonitorX Health Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment="SERVERPULSE_ID=\${SERVERPULSE_ID}"
Environment="SERVERPULSE_KEY=\${SERVERPULSE_KEY}"
Environment="SERVERPULSE_URL=\${URL}"
ExecStart=/usr/bin/python3 /opt/monitorx-agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable monitorx-agent.service
  sudo systemctl restart monitorx-agent.service
  echo "================================================"
  echo "✅ MonitorX Agent installed & started!"
  echo "🚀 Auto-start enabled: MonitorX Agent will resume on reboot."
  echo "================================================"
else
  echo ""
  echo "Agent downloaded to /opt/monitorx-agent.py"
  echo "To enable Auto-Start service on boot, re-run with environment variables:"
  echo "  SERVERPULSE_ID=my-server SERVERPULSE_KEY=shd_xxx curl -fsSL ${host}/install.sh | sudo -E bash"
fi
`;
  res.setHeader('Content-Type', 'text/x-sh');
  res.send(script);
});

// ── Frontend static serving ───────────────────────────────────────────────────
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
const frontendBuildPath = path.join(__dirname, '../../frontend/build');
const staticPath = fs.existsSync(frontendDistPath) ? frontendDistPath : (fs.existsSync(frontendBuildPath) ? frontendBuildPath : null);

if (staticPath) {
  app.use(express.static(staticPath));
  app.get('/{*path}', (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl === '/agent.py' || req.originalUrl === '/install.sh') {
      return next();
    }
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'MonitorX API is running', timestamp: new Date() });
  });
}

// ── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;

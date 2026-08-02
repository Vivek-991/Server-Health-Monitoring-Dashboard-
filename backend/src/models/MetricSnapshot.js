const mongoose = require('mongoose');

const MetricSnapshotSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      index: true,
    },
    serverId: {
      type: String,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    cpu: {
      usage: { type: Number },
      cores: { type: Number },
      speed: { type: Number },
      model: { type: String },
    },
    memory: {
      total: { type: Number },
      used: { type: Number },
      free: { type: Number },
      usagePercent: { type: Number },
    },
    disk: [
      {
        fs: { type: String },
        mount: { type: String },
        size: { type: Number },
        used: { type: Number },
        usagePercent: { type: Number },
      },
    ],
    network: {
      rx_bytes: { type: Number },
      tx_bytes: { type: Number },
      rx_sec: { type: Number },
      tx_sec: { type: Number },
      interface: { type: String },
    },
    uptime: { type: Number },
    temperature: {
      main: { type: Number },
      cores: [{ type: Number }],
      max: { type: Number },
    },
    load: {
      avgLoad: { type: Number },
      currentLoad: { type: Number },
    },
    services: [
      {
        name: { type: String },
        running: { type: Boolean },
        pid: { type: Number },
      },
    ],
    status: {
      type: String,
      enum: ['online', 'offline', 'degraded'],
      default: 'online',
    },
  },
  {
    timestamps: false,
    collection: 'metric_snapshots',
  }
);

MetricSnapshotSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });
MetricSnapshotSchema.index({ user: 1, timestamp: -1 });
MetricSnapshotSchema.index({ server: 1, timestamp: -1 });

module.exports = mongoose.model('MetricSnapshot', MetricSnapshotSchema);

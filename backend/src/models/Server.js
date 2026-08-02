const mongoose = require('mongoose');

const ServerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Server name is required'],
      trim: true,
    },
    hostname: {
      type: String,
      default: '',
    },
    ip: {
      type: String,
      default: '',
    },
    serverId: {
      type: String,
      unique: true,
      sparse: true,
    },
    apiKey: {
      type: String,
      select: false,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'degraded'],
      default: 'offline',
    },
    lastSeen: Date,
    metadata: {
      cpu: {
        model: String,
        cores: Number,
        speed: Number,
      },
      memory: {
        total: Number,
      },
      os: String,
      platform: String,
    },
    tags: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

ServerSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Server', ServerSchema);

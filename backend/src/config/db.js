const dns = require('dns');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Resolve querySrv ECONNREFUSED by setting reliable DNS servers (Google / Cloudflare)
try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {
  // Ignore DNS setServers failure
}

mongoose.set('bufferCommands', false);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.warn(`MongoDB unavailable: ${error.message}. Continuing without persistence.`);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB connection error: ${err.message}`);
});

const isDBConnected = () => mongoose.connection.readyState === 1;

module.exports = connectDB;
module.exports.isDBConnected = isDBConnected;

const dns = require('dns');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Disable query buffering so Mongoose queries fail fast when DB is disconnected
mongoose.set('bufferCommands', false);

// Resolve querySrv ECONNREFUSED by setting reliable DNS servers (Google / Cloudflare)
try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {
  // Ignore DNS setServers failure
}

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    logger.warn('⚠️ MONGO_URI is not defined in environment variables.');
    return;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`❌ MongoDB Connection Failed: ${error.message}`);
    logger.warn(`   Please check your MONGO_URI in backend/.env (e.g. database credentials or IP whitelist).`);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`❌ MongoDB connection error: ${err.message}`);
});

const isDBConnected = () => mongoose.connection.readyState === 1;

module.exports = connectDB;
module.exports.isDBConnected = isDBConnected;


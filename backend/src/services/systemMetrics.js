const si = require('systeminformation');
const os = require('os');

// Common Windows/Linux services to monitor
const SERVICES_TO_CHECK = process.platform === 'win32'
  ? 'wuauserv,spooler,W32Time,Dhcp,Dnscache,EventLog,Schedule,LanmanServer,Netlogon,BITS'
  : 'ssh,nginx,apache2,mysql,postgresql,redis,mongod,docker,cron,sshd';

/**
 * Collect all system metrics in one shot.
 * Returns a structured object matching the MetricSnapshot schema.
 */
const collectMetrics = async () => {
  // Run all queries in parallel for performance
  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  const [
    cpuLoad,
    cpuData,
    mem,
    fsSize,
    netStats,
    temp,
    services,
  ] = await Promise.all([
    si.currentLoad(),
    si.cpu(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.cpuTemperature().catch(() => ({ main: null, cores: [], max: null })),
    withTimeout(si.services(SERVICES_TO_CHECK), 3000).catch(() => []),
  ]);

  // ── CPU ──────────────────────────────────────────────────────────────────
  const cpu = {
    usage: parseFloat(cpuLoad.currentLoad.toFixed(2)),
    cores: cpuData.physicalCores || os.cpus().length,
    speed: cpuData.speed || 0,
    model: cpuData.brand || os.cpus()[0]?.model || 'Unknown',
  };

  // ── Memory ───────────────────────────────────────────────────────────────
  const memory = {
    total: mem.total,
    used: mem.used,
    free: mem.free,
    usagePercent: parseFloat(((mem.used / mem.total) * 100).toFixed(2)),
  };

  // ── Disk ─────────────────────────────────────────────────────────────────
  const disk = fsSize
    .filter((d) => d.size > 0)
    .map((d) => ({
      fs: d.fs,
      mount: d.mount,
      size: d.size,
      used: d.used,
      usagePercent: parseFloat(d.use.toFixed(2)),
    }));

  // ── Network ──────────────────────────────────────────────────────────────
  const primaryNet = netStats[0] || {};
  const network = {
    rx_bytes: primaryNet.rx_bytes || 0,
    tx_bytes: primaryNet.tx_bytes || 0,
    rx_sec: parseFloat((primaryNet.rx_sec || 0).toFixed(2)),
    tx_sec: parseFloat((primaryNet.tx_sec || 0).toFixed(2)),
    interface: primaryNet.iface || 'eth0',
  };

  // ── Uptime ───────────────────────────────────────────────────────────────
  const uptime = os.uptime();

  // ── Temperature ──────────────────────────────────────────────────────────
  const temperature = {
    main: temp.main ?? null,
    cores: temp.cores ?? [],
    max: temp.max ?? null,
  };


  // ── Load ─────────────────────────────────────────────────────────────────
  let avgLoad = cpuLoad.avgLoad;
  if (!avgLoad || avgLoad <= 0) {
    // Windows fallback: CPU usage factor * cores
    avgLoad = (cpuLoad.currentLoad / 100) * cpu.cores;
  }

  const load = {
    avgLoad: parseFloat(avgLoad.toFixed(2)),
    currentLoad: parseFloat(cpuLoad.currentLoad.toFixed(2)),
  };

  // ── Services ─────────────────────────────────────────────────────────────
  const runningServices = services.slice(0, 20).map((s) => ({
    name: s.name,
    running: s.running,
    pid: s.pid || null,
  }));

  return {
    cpu,
    memory,
    disk,
    network,
    uptime,
    temperature,
    load,
    services: runningServices,
    status: 'online',
    timestamp: new Date(),
  };
};

module.exports = { collectMetrics };

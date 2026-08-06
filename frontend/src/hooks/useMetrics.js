import { useMetricsContext } from '../context/MetricsContext';

/**
 * Custom hook — exposes metrics state in a convenient, typed shape.
 * Keeps components decoupled from the context implementation.
 */
const useMetrics = (serverId) => {
  const { current, history, historyMap = {}, agents, connected, loading, error } = useMetricsContext();

  const activeAgent = serverId ? agents[serverId] : null;
  const metrics = activeAgent || current;
  const serverHistory = serverId ? (historyMap[serverId] || []) : (history || []);

  return {
    // Connection
    connected,
    loading,
    error,

    // All active remote server agents
    agents: agents || {},
    historyMap: historyMap || {},

    // CPU
    cpuUsage: metrics?.cpu?.usage ?? null,
    cpuModel: metrics?.cpu?.model ?? 'Unknown',
    cpuCores: metrics?.cpu?.cores ?? 0,
    cpuSpeed: metrics?.cpu?.speed ?? 0,

    // Memory
    memTotal: metrics?.memory?.total ?? 0,
    memUsed: metrics?.memory?.used ?? 0,
    memFree: metrics?.memory?.free ?? 0,
    memPercent: metrics?.memory?.usagePercent ?? 0,

    // Disk
    disks: metrics?.disks || metrics?.disk || [],

    // Network
    network: metrics?.network ?? {},

    // Uptime
    uptime: metrics?.os?.uptime ?? metrics?.uptime ?? 0,

    // Temperature
    temperature: metrics?.temperatures?.[0] || metrics?.temperature || {},

    // Load
    load: metrics?.load ?? {},

    // Services
    services: metrics?.services ?? [],

    // Status
    status: metrics?.status ?? 'offline',

    // Historical data (for charts)
    history: serverHistory,

    // Raw current snapshot
    current: metrics,
  };
};

export default useMetrics;

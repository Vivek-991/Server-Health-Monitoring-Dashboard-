import { useMetricsContext } from '../context/MetricsContext';

/**
 * Custom hook — exposes metrics state in a convenient, typed shape.
 * Keeps components decoupled from the context implementation.
 */
const useMetrics = () => {
  const { current, history, agents, connected, loading, error } = useMetricsContext();

  return {
    // Connection
    connected,
    loading,
    error,

    // All active remote server agents
    agents: agents || {},


    // CPU
    cpuUsage: current?.cpu?.usage ?? null,
    cpuModel: current?.cpu?.model ?? 'Unknown',
    cpuCores: current?.cpu?.cores ?? 0,
    cpuSpeed: current?.cpu?.speed ?? 0,

    // Memory
    memTotal: current?.memory?.total ?? 0,
    memUsed: current?.memory?.used ?? 0,
    memFree: current?.memory?.free ?? 0,
    memPercent: current?.memory?.usagePercent ?? 0,

    // Disk
    disks: current?.disk ?? [],

    // Network
    network: current?.network ?? {},

    // Uptime
    uptime: current?.uptime ?? 0,

    // Temperature
    temperature: current?.temperature ?? {},

    // Load
    load: current?.load ?? {},

    // Services
    services: current?.services ?? [],

    // Status
    status: current?.status ?? 'offline',

    // Historical data (for charts)
    history,

    // Raw current snapshot
    current,
  };
};

export default useMetrics;

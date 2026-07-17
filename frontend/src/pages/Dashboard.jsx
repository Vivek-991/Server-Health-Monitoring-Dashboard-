import React from 'react';
import useMetrics from '../hooks/useMetrics';

// Common
import Navbar   from '../components/common/Navbar';
import Sidebar  from '../components/common/Sidebar';
import Loader   from '../components/common/Loader';

// Cards
import MetricCard      from '../components/cards/MetricCard';
import UptimeCard      from '../components/cards/UptimeCard';
import ServicesCard    from '../components/cards/ServicesCard';
import TemperatureCard from '../components/cards/TemperatureCard';
import SystemLoadCard  from '../components/cards/SystemLoadCard';
import HealthScoreCard from '../components/cards/HealthScoreCard';
import RecentAlertsCard from '../components/cards/RecentAlertsCard';
import ActivityLogCard from '../components/cards/ActivityLogCard';

// Charts
import CpuChart     from '../components/charts/CpuChart';
import RamChart     from '../components/charts/RamChart';
import DiskChart    from '../components/charts/DiskChart';
import NetworkChart from '../components/charts/NetworkChart';

// Styles
import '../styles/dashboard.css';

// Formatters
import { formatBytes, formatBandwidth, toFixed } from '../utils/formatters';

const Dashboard = () => {
  const {
    loading, error,
    cpuUsage, cpuModel, cpuCores,
    memPercent, memTotal, memUsed,
    disks,
    network,
    connected,
    status,
  } = useMetrics();

  if (loading) return <Loader message="Connecting to server…" />;

  const primaryDisk = disks[0] || {};

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />

        <main className="dashboard-page" id="dashboard">
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="dashboard-header">
            <h1>System Overview</h1>
            <p>
              Real-time server health metrics · auto-refreshes every 2 seconds
              {error && (
                <span style={{
                  marginLeft: '12px', color: 'var(--color-accent-red)',
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                }}>
                  ⚠ {error}
                </span>
              )}
            </p>
          </div>

          {/* ── Top Stats Row ───────────────────────────────────────── */}
          <div className="stats-grid" id="metrics-grid">
            <MetricCard
              label="CPU Usage"
              value={toFixed(cpuUsage)}
              unit="%"
              sub={`${cpuCores} cores · ${cpuModel}`}
              icon="🖥️"
              percent={cpuUsage}
              accentColor="linear-gradient(90deg, #6384ff, #a855f7)"
              iconBg="rgba(99,132,255,0.1)"
              iconColor="#6384ff"
              delay={0}
            />
            <MetricCard
              label="RAM Usage"
              value={toFixed(memPercent)}
              unit="%"
              sub={`${formatBytes(memUsed)} / ${formatBytes(memTotal)}`}
              icon="💾"
              percent={memPercent}
              accentColor="linear-gradient(90deg, #00d4ff, #6384ff)"
              iconBg="rgba(0,212,255,0.1)"
              iconColor="#00d4ff"
              delay={60}
            />
            <MetricCard
              label="Disk Usage"
              value={toFixed(primaryDisk.usagePercent ?? 0)}
              unit="%"
              sub={primaryDisk.mount ? `${primaryDisk.mount} · ${formatBytes(primaryDisk.used)} used` : 'No disk data'}
              icon="💿"
              percent={primaryDisk.usagePercent ?? 0}
              accentColor="linear-gradient(90deg, #22c55e, #00d4ff)"
              iconBg="rgba(34,197,94,0.1)"
              iconColor="#22c55e"
              delay={120}
            />
            <MetricCard
              label="Network ↓"
              value={formatBandwidth(network?.rx_sec)}
              sub={`↑ ${formatBandwidth(network?.tx_sec)} · ${network?.interface || 'eth0'}`}
              icon="🌐"
              accentColor="linear-gradient(90deg, #f59e0b, #f97316)"
              iconBg="rgba(245,158,11,0.1)"
              iconColor="#f59e0b"
              delay={180}
            />
            <MetricCard
              label="Server Status"
              value={connected ? 'Online' : 'Offline'}
              sub="Socket.IO live connection"
              icon={connected ? '✅' : '❌'}
              accentColor={connected
                ? 'linear-gradient(90deg, #22c55e, #00d4ff)'
                : 'linear-gradient(90deg, #ef4444, #f97316)'}
              iconBg={connected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}
              iconColor={connected ? '#22c55e' : '#ef4444'}
              delay={240}
            />
          </div>

          {/* ── Health Score ────────────────────────────────────────── */}
          <p className="section-title" id="health-score">Health Score</p>
          <div className="health-score-row">
            <HealthScoreCard />
          </div>

          {/* ── Charts ─────────────────────────────────────────────── */}
          <p className="section-title">Performance Charts</p>
          <div className="charts-grid">
            <CpuChart />
            <RamChart />
            <DiskChart />
            <NetworkChart />
          </div>

          {/* ── System Details ──────────────────────────────────────── */}
          <p className="section-title">System Details</p>
          <div className="bottom-grid">
            <UptimeCard />
            <TemperatureCard />
            <SystemLoadCard />
          </div>

          {/* ── Alerts + Activity ───────────────────────────────────── */}
          <p className="section-title" id="recent-alerts">Alerts & Activity</p>
          <div className="alerts-activity-grid">
            <RecentAlertsCard />
            <ActivityLogCard />
          </div>

          {/* ── Services ───────────────────────────────────────────── */}
          <p className="section-title" id="services">Running Services</p>
          <ServicesCard />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

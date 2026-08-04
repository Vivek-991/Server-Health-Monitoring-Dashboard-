import React, { useState, useMemo } from 'react';
import useMetrics from '../hooks/useMetrics';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/common/PageLayout';
import Loader from '../components/common/Loader';
import AddServerModal from '../pages/ServersPage'; // We will also export modal or import it directly

// Cards
import MetricCard from '../components/cards/MetricCard';
import UptimeCard from '../components/cards/UptimeCard';
import ServicesCard from '../components/cards/ServicesCard';
import TemperatureCard from '../components/cards/TemperatureCard';
import SystemLoadCard from '../components/cards/SystemLoadCard';
import HealthScoreCard from '../components/cards/HealthScoreCard';
import RecentAlertsCard from '../components/cards/RecentAlertsCard';
import ActivityLogCard from '../components/cards/ActivityLogCard';

// Charts
import CpuChart from '../components/charts/CpuChart';
import RamChart from '../components/charts/RamChart';
import DiskChart from '../components/charts/DiskChart';
import NetworkChart from '../components/charts/NetworkChart';

// Styles & Formatters
import '../styles/dashboard.css';
import { formatBytes, formatBandwidth, toFixed } from '../utils/formatters';

const Dashboard = () => {
  const { user } = useAuth();
  const { agents, loading, error } = useMetrics();
  const [selectedServerId, setSelectedServerId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Convert active agent map into array of remote servers
  const remoteServerList = useMemo(() => {
    return Object.keys(agents).map((key) => {
      const ag = agents[key];
      return {
        id: ag.id || key,
        name: ag.name || key,
        hostname: ag.hostname || key,
        ip: ag.ip || '—',
        os: ag.os?.distro || 'Linux',
        status: ag.status || 'online',
        lastSeen: ag.lastSeen || ag.timestamp,
        metrics: ag,
      };
    });
  }, [agents]);

  // Determine currently selected server
  const activeServer = useMemo(() => {
    if (!remoteServerList.length) return null;
    const found = remoteServerList.find((s) => s.id === selectedServerId);
    return found || remoteServerList[0];
  }, [remoteServerList, selectedServerId]);

  const backendBaseUrl = useMemo(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    return apiUrl.replace(/\/api\/?$/, '');
  }, []);

  if (loading) return <Loader message="Loading dashboard metrics…" />;

  const isOffline = activeServer?.status === 'offline';
  const m = activeServer?.metrics || {};

  const cpuUsage = isOffline ? 0 : (m.cpu?.usage ?? 0);
  const cpuCores = m.cpu?.cores ?? 1;
  const cpuModel = m.cpu?.model || 'Cloud VM Processor';

  const memPercent = isOffline ? 0 : (m.memory?.usagePercent ?? 0);
  const memUsed = isOffline ? 0 : (m.memory?.used ?? 0);
  const memTotal = isOffline ? 0 : (m.memory?.total ?? 0);

  const diskList = m.disks || m.disk || [];
  const primaryDisk = diskList[0] || {};
  const diskPercent = isOffline ? 0 : (primaryDisk.usagePercent ?? 0);

  const network = isOffline ? {} : (m.network || {});

  return (
    <PageLayout>
      <main className="dashboard-page" id="dashboard">
        {/* ── Top Bar with Server Selector + Add Server Button ───────────────── */}
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              ⚡ External Server Dashboard
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              Monitoring remote cloud servers (AWS EC2, VPS) in real-time
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Server Selector Dropdown */}
            {remoteServerList.length > 0 && (
              <div style={{ position: 'relative' }}>
                <select
                  value={activeServer?.id || ''}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  style={{
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '600',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {remoteServerList.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.status === 'online' ? '🟢' : '🔴'} {srv.name} ({srv.ip})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Connect New Server Button */}
            <button
              className="btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ padding: '10px 16px', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              ➕ Connect a Server
            </button>
          </div>
        </div>

        {/* ── Empty State: No Remote Servers Connected ────────────────────────── */}
        {!remoteServerList.length ? (
          <div style={{
            textAlign: 'center',
            padding: '70px 24px',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border)',
            margin: '24px 0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>☁️</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '10px' }}>No External Servers Connected</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', maxWidth: '520px', margin: '0 auto 24px', lineHeight: '1.6' }}>
              Deploy the MonitorX agent on your AWS EC2 instance, DigitalOcean Droplet, or VPS to start tracking CPU, RAM, Disk, and bandwidth in real-time.
            </p>
            <button
              className="btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ padding: '12px 24px', fontSize: 'var(--text-base)', fontWeight: '700' }}
            >
              🚀 Connect Your First Server
            </button>
          </div>
        ) : (
          <>
            {/* ── Selected Remote Server Badge ───────────────────────────────────── */}
            <div style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 18px',
              margin: '20px 0',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: activeServer.status === 'online' ? '#22c55e' : '#ef4444',
                  boxShadow: activeServer.status === 'online' ? '0 0 10px #22c55e' : 'none'
                }} />
                <div>
                  <span style={{ fontWeight: '700', fontSize: 'var(--text-base)' }}>{activeServer.name}</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', marginLeft: '10px' }}>
                    {activeServer.hostname} · {activeServer.ip} · {activeServer.os}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Status: <strong style={{ color: activeServer.status === 'online' ? '#22c55e' : '#ef4444' }}>{activeServer.status.toUpperCase()}</strong>
              </div>
            </div>

            {/* ── Top Metrics Stats Grid ────────────────────────────────────────── */}
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
                value={toFixed(diskPercent)}
                unit="%"
                sub={primaryDisk.mount ? `${primaryDisk.mount} · ${formatBytes(primaryDisk.used || 0)} used` : 'No disk'}
                icon="💿"
                percent={diskPercent}
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
            </div>

            {/* ── Health Score ────────────────────────────────────────── */}
            <p className="section-title" id="health-score">Health Score</p>
            <div className="health-score-row">
              <HealthScoreCard metrics={m} />
            </div>

            {/* ── Performance Charts ──────────────────────────────────── */}
            <p className="section-title">Performance Charts</p>
            <div className="charts-grid">
              <CpuChart metrics={m} />
              <RamChart metrics={m} />
              <DiskChart metrics={m} />
              <NetworkChart metrics={m} />
            </div>

            {/* ── System Details ──────────────────────────────────────── */}
            <p className="section-title">Remote System Details</p>
            <div className="bottom-grid">
              <UptimeCard uptime={m.os?.uptime || 0} status={activeServer.status} />
              <TemperatureCard temperature={m.temperatures?.[0]} />
              <SystemLoadCard load={m.load} cpuCores={cpuCores} />
            </div>

            {/* ── Alerts & Activity ───────────────────────────────────── */}
            <p className="section-title" id="recent-alerts">Alerts & Activity</p>
            <div className="alerts-activity-grid">
              <RecentAlertsCard />
              <ActivityLogCard />
            </div>

            {/* ── Running Services ───────────────────────────────────── */}
            <p className="section-title" id="services">Running Services</p>
            <ServicesCard services={m.services || []} />
          </>
        )}

        {/* ── Connect Server Modal Overlay ───────────────────────────────────── */}
        {showAddModal && (
          <AddServerModalInline
            onClose={() => setShowAddModal(false)}
            backendBaseUrl={backendBaseUrl}
            currentUser={user}
          />
        )}
      </main>
    </PageLayout>
  );
};

// Inline Add Server Modal component for Dashboard use
const AddServerModalInline = ({ onClose, backendBaseUrl, currentUser }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🖥️ Connect an External Server</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Go to the <strong>Servers</strong> page to create a server and get your pre-filled setup command with a unique API key for {currentUser?.name || 'your account'}.
        </p>

        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <a
            href="/servers"
            className="btn-primary"
            style={{ display: 'inline-block', textDecoration: 'none', padding: '12px 24px', fontSize: 'var(--text-base)' }}
          >
            → Go to Servers Page to Connect
          </a>
        </div>
        <div className="modal-actions" style={{ marginTop: '12px' }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

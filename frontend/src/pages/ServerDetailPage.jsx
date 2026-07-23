import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageLayout from '../components/common/PageLayout';
import useMetrics from '../hooks/useMetrics';
import { computeHealthScore } from '../utils/healthScore';
import { formatBytes, formatBandwidth } from '../utils/formatters';
import { deleteAgentServer } from '../api/metricsApi';

// ── Helper components ─────────────────────────────────────────────────────────
const MetricBar = ({ label, value, max = 100, unit = '%', color }) => {
  const pct = Math.min((value / max) * 100, 100);
  const c = color || (pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e');
  return (
    <div className="detail-metric-row">
      <span className="detail-metric-label">{label}</span>
      <div className="detail-bar-track">
        <div className="detail-bar-fill" style={{ width: `${pct}%`, background: c }} />
      </div>
      <span className="detail-metric-val" style={{ color: c }}>{typeof value === 'number' ? value.toFixed(1) : value}{unit}</span>
    </div>
  );
};

const InfoGrid = ({ items }) => (
  <div className="detail-info-grid">
    {items.map(([label, val]) => (
      <div key={label} className="detail-info-item">
        <span className="detail-info-label">{label}</span>
        <span className="detail-info-val">{val ?? '—'}</span>
      </div>
    ))}
  </div>
);

const Section = ({ title, icon, children }) => (
  <div className="card detail-section">
    <div className="detail-section-header">
      <span className="detail-section-icon">{icon}</span>
      <span className="detail-section-title">{title}</span>
    </div>
    {children}
  </div>
);

// ── Live server detail (uses real MetricsContext data, compatible with remote agents) ──
const LiveServerDetail = ({ current }) => {
  const { score, grade, color } = useMemo(() => computeHealthScore(current), [current]);
  const disk = current?.disks?.[0] || {};
  const net  = current?.network || {};
  const temps = current?.temperatures || [];
  const services = current?.services || [];

  return (
    <>
      <div className="detail-hero">
        <div className="detail-score-block">
          <div className="detail-score-num" style={{ color }}>{score}</div>
          <div className="detail-score-grade" style={{ color }}>{grade}</div>
          <div className="detail-score-label">Health Score</div>
        </div>
        <InfoGrid items={[
          ['Hostname',    current?.hostname || window.location.hostname],
          ['IP Address',  current?.ip || '127.0.0.1'],
          ['OS',          current?.os?.distro || 'Local'],
          ['Platform',    current?.os?.platform || '—'],
          ['Uptime',      current?.os ? formatUptime(current.os.uptime) : '—'],
          ['CPU Model',   current?.cpu?.model || '—'],
          ['CPU Cores',   current?.cpu?.cores ?? '—'],
          ['Total RAM',   current?.memory ? formatBytes(current.memory.total) : '—'],
        ]} />
      </div>

      <div className="detail-grid">
        <Section title="CPU" icon="🖥️">
          <MetricBar label="Usage" value={current?.cpu?.usage ?? 0} />
          {current?.load && (
            <>
              <MetricBar label="Load (1m)" value={(current.load.load1 ?? (current.load.avgLoad ?? 0)) * 10} />
              {current.load.load5 && <MetricBar label="Load (5m)" value={current.load.load5 * 10} />}
            </>
          )}
        </Section>

        <Section title="Memory" icon="💾">
          <MetricBar label="Used" value={current?.memory?.usagePercent ?? 0} />
          <InfoGrid items={[
            ['Used',  current?.memory ? formatBytes(current.memory.used) : '—'],
            ['Free',  current?.memory ? formatBytes(current.memory.free) : '—'],
            ['Total', current?.memory ? formatBytes(current.memory.total) : '—'],
          ]} />
        </Section>

        <Section title="Disk" icon="💿">
          <MetricBar label={disk.mount || '/'} value={disk.usagePercent ?? 0} />
          <InfoGrid items={[
            ['Used',       disk.used ? formatBytes(disk.used) : '—'],
            ['Free',       disk.size && disk.used ? formatBytes(disk.size - disk.used) : '—'],
            ['Total',      disk.size ? formatBytes(disk.size) : '—'],
            ['Filesystem', disk.fs || '—'],
          ]} />
        </Section>

        <Section title="Network" icon="🌐">
          <InfoGrid items={[
            ['Interface',    net.interface || 'eth0'],
            ['Download',     formatBandwidth(net.rx_sec)],
            ['Upload',       formatBandwidth(net.tx_sec)],
            ['Total RX',     formatBytes(net.rx_bytes)],
            ['Total TX',     formatBytes(net.tx_bytes)],
          ]} />
        </Section>

        <Section title="Temperature" icon="🌡️">
          {temps.length === 0
            ? <p className="detail-empty">No temperature data available.</p>
            : temps.slice(0, 5).map((t, i) => (
              <MetricBar key={i} label={t.label || `Sensor ${i+1}`} value={t.main ?? 0} max={100} unit="°C" />
            ))
          }
        </Section>

        <Section title="Services" icon="⚙️">
          {services.length === 0 ? (
            <p className="detail-empty">No active system services reported.</p>
          ) : (
            <div className="services-list">
              {services.slice(0, 10).map((s) => (
                <div key={s.name} className="service-row">
                  <span className={`service-dot ${s.running ? 'running' : 'stopped'}`} />
                  <span className="service-name">{s.name}</span>
                  <span className={`service-status ${s.running ? 'running' : 'stopped'}`}>{s.running ? 'running' : 'stopped'}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const ServerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { current: localCurrent, agents } = useMetrics();

  const isLocal = id === 'local';
  const agentMetrics = agents[id];

  if (!isLocal && !agentMetrics) {
    return (
      <PageLayout>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">Server Not Found</h1>
          <button className="btn-ghost" onClick={() => navigate('/servers')}>← Back to Servers</button>
        </div>
        <div className="empty-state" style={{ marginTop: '32px', textAlign: 'center' }}>
          This server is not registered or has been removed.
        </div>
      </PageLayout>
    );
  }

  const isCloudHost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const name = isLocal 
    ? (isCloudHost ? `Primary Server (${window.location.hostname})` : 'Primary Server (Central)')
    : `${agentMetrics.name || id}`;

  const handleDeleteServer = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete server "${name}"?\n\nThis will remove it from the monitoring dashboard. Make sure to stop the agent.py script running on that server so it does not reconnect.`
    );
    if (!confirmDelete) return;

    try {
      await deleteAgentServer(id);
      navigate('/servers');
    } catch (err) {
      alert(`Failed to delete server: ${err.message}`);
    }
  };

  return (
    <PageLayout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div>
          <div className="breadcrumb">
            <button className="breadcrumb-btn" onClick={() => navigate('/servers')}>Servers</button>
            <span className="breadcrumb-sep">›</span>
            <span>{name}</span>
            {isLocal && <span className="live-pill">● LIVE</span>}
            {!isLocal && agentMetrics && (
              agentMetrics.status === 'offline' ? (
                <span className="offline-pill" style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  marginLeft: 'var(--space-2)'
                }}>● OFFLINE</span>
              ) : (
                <span className="live-pill">● LIVE</span>
              )
            )}
          </div>
          <h1 className="page-title">{name}</h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!isLocal && (
            <button
              onClick={handleDeleteServer}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.color = '#ef4444';
              }}
            >
              🗑️ Delete Server
            </button>
          )}
          <button className="btn-ghost" onClick={() => navigate('/servers')}>← Back to Servers</button>
        </div>
      </div>

      {isLocal && <LiveServerDetail current={localCurrent} />}
      {!isLocal && agentMetrics && (
        <>
          {agentMetrics.status === 'offline' && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              marginBottom: '24px',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: 'var(--text-sm)',
              textAlign: 'left'
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <div>
                <strong>Server Offline</strong> — The agent on this server stopped sending metrics. Last heartbeat was received at {new Date(agentMetrics.timestamp).toLocaleString()}.
              </div>
            </div>
          )}
          <div style={{ opacity: agentMetrics.status === 'offline' ? 0.75 : 1, transition: 'opacity 0.3s ease' }}>
            <LiveServerDetail current={agentMetrics} />
          </div>
        </>
      )}
    </PageLayout>
  );
};

const formatUptime = (s) => {
  if (!s) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
};

export default ServerDetailPage;


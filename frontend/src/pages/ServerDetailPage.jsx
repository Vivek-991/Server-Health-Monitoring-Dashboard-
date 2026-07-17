import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageLayout from '../components/common/PageLayout';
import useMetrics from '../hooks/useMetrics';
import { computeHealthScore } from '../utils/healthScore';
import { formatBytes, formatBandwidth } from '../utils/formatters';

// ── Same demo data as ServersPage ─────────────────────────────────────────────
const DEMO_SERVERS = {
  'web-01':    { id:'web-01',    name:'web-01',    hostname:'web-01.prod',    ip:'10.0.1.11', os:'Ubuntu 22.04', role:'Web Server', cpu:42, ram:61, disk:54, temp:48, uptime:'14d 6h',  status:'online',   services:[{name:'nginx',status:'running'},{name:'node',status:'running'},{name:'ssh',status:'running'}] },
  'db-01':     { id:'db-01',     name:'db-01',     hostname:'db-01.prod',     ip:'10.0.1.20', os:'CentOS 8',    role:'Database',   cpu:67, ram:78, disk:71, temp:62, uptime:'32d 1h',  status:'warning',  services:[{name:'postgres',status:'running'},{name:'redis',status:'running'},{name:'ssh',status:'running'}] },
};

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

// ── Demo server detail ─────────────────────────────────────────────────────────
const DemoServerDetail = ({ server }) => {
  const statusColor = server.status === 'online' ? '#22c55e' : server.status === 'warning' ? '#f59e0b' : '#ef4444';
  const score = Math.round(100 - server.cpu*0.25 - server.ram*0.25 - server.disk*0.2 - Math.max(0, server.temp - 40)*0.5);
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D';

  return (
    <>
      <div className="detail-hero">
        <div className="detail-score-block">
          <div className="detail-score-num" style={{ color: statusColor }}>{score}</div>
          <div className="detail-score-grade" style={{ color: statusColor }}>{grade}</div>
          <div className="detail-score-label">Health Score</div>
        </div>
        <InfoGrid items={[
          ['Hostname',  server.hostname],
          ['IP Address',server.ip],
          ['OS',        server.os],
          ['Role',      server.role],
          ['Uptime',    server.uptime],
          ['Services',  `${server.services.length} tracked`],
        ]} />
      </div>

      <div className="detail-grid">
        <Section title="CPU" icon="🖥️">
          <MetricBar label="Usage" value={server.cpu} />
        </Section>
        <Section title="Memory" icon="💾">
          <MetricBar label="Used" value={server.ram} />
        </Section>
        <Section title="Disk" icon="💿">
          <MetricBar label="/" value={server.disk} />
        </Section>
        <Section title="Temperature" icon="🌡️">
          <MetricBar label="CPU Temp" value={server.temp} max={100} unit="°C" />
        </Section>
        <Section title="Services" icon="⚙️">
          <div className="services-list">
            {server.services.map((s) => (
              <div key={s.name} className="service-row">
                <span className={`service-dot ${s.status}`} />
                <span className="service-name">{s.name}</span>
                <span className={`service-status ${s.status}`}>{s.status}</span>
              </div>
            ))}
          </div>
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
  const demo = DEMO_SERVERS[id];

  if (!isLocal && !agentMetrics && !demo) {
    return (
      <PageLayout>
        <div className="page-header">
          <button className="btn-ghost" onClick={() => navigate('/servers')}>← Back</button>
        </div>
        <div className="empty-state">Server not found.</div>
      </PageLayout>
    );
  }

  const name = isLocal 
    ? 'localhost (Live)' 
    : agentMetrics 
      ? `${agentMetrics.name || id}`
      : demo.name;

  return (
    <PageLayout>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <button className="breadcrumb-btn" onClick={() => navigate('/servers')}>Servers</button>
            <span className="breadcrumb-sep">›</span>
            <span>{name}</span>
            {(isLocal || agentMetrics) && <span className="live-pill">● LIVE</span>}
          </div>
          <h1 className="page-title">{name}</h1>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/servers')}>← Back to Servers</button>
      </div>

      {isLocal && <LiveServerDetail current={localCurrent} />}
      {!isLocal && agentMetrics && <LiveServerDetail current={agentMetrics} />}
      {!isLocal && !agentMetrics && demo && <DemoServerDetail server={demo} />}
    </PageLayout>
  );
};

const formatUptime = (s) => {
  if (!s) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
};

export default ServerDetailPage;

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/common/PageLayout';
import useMetrics from '../hooks/useMetrics';
import { computeHealthScore } from '../utils/healthScore';

// ── Fallback Demo Servers if no agents exist ───────────────────────────────
const DEMO_SERVERS = [
  { id: 'web-01', name: 'web-01', hostname: 'web-01.prod', ip: '10.0.1.11', os: 'Ubuntu 22.04', role: 'Web Server', cpu: 42, ram: 61, disk: 54, temp: 48, uptime: '14d 6h', status: 'online',   services: 8 },
  { id: 'db-01',  name: 'db-01',  hostname: 'db-01.prod',  ip: '10.0.1.20', os: 'CentOS 8',    role: 'Database',   cpu: 67, ram: 78, disk: 71, temp: 62, uptime: '32d 1h', status: 'warning',  services: 5 },
];

const fakeScore = ({ cpu, ram, disk, temp }) => {
  const s = 100 - cpu * 0.25 - ram * 0.25 - disk * 0.2 - Math.max(0, (temp || 40) - 40) * 0.5;
  return Math.round(Math.max(0, Math.min(100, s)));
};

const scoreColor = (s) =>
  s >= 80 ? '#22c55e' : s >= 65 ? '#f59e0b' : s >= 50 ? '#f97316' : '#ef4444';

const statusBadge = (s) => ({
  online:   { label: 'Online',   color: '#22c55e' },
  warning:  { label: 'Degraded', color: '#f59e0b' },
  critical: { label: 'Critical', color: '#ef4444' },
  offline:  { label: 'Offline',  color: '#888888' },
}[s] || { label: s, color: '#888888' });

// ── Mini ring gauge ───────────────────────────────────────────────────────────
const Ring = ({ score, size = 60 }) => {
  const color = scoreColor(score);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-bg-secondary)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  );
};

// ── Server Card ───────────────────────────────────────────────────────────────
const ServerCard = ({ server, onClick }) => {
  const badge  = statusBadge(server.status);
  const score  = server.score;
  const color  = scoreColor(score);
  return (
    <div className="srv-card" onClick={onClick} title={`Open ${server.name}`}>
      <div className="srv-card-top">
        <div className="srv-card-info">
          <div className="srv-card-name">{server.name}</div>
          <div className="srv-card-hostname">{server.hostname} · {server.ip}</div>
          <div className="srv-card-os">{server.os} · {server.role}</div>
        </div>
        <div className="srv-card-ring-wrap">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Ring score={score} />
            <div className="srv-ring-center" style={{ color }}>{score}</div>
          </div>
        </div>
      </div>

      <div className="srv-card-badge-row">
        <span className="srv-status-badge" style={{ background: `${badge.color}18`, color: badge.color, borderColor: `${badge.color}30` }}>
          <span style={{ background: badge.color, borderRadius: '50%', width: 6, height: 6, display: 'inline-block', marginRight: 5 }} />
          {badge.label}
        </span>
        <span className="srv-uptime">⏱ {server.uptime}</span>
      </div>

      <div className="srv-metrics-row">
        {[['🖥️','CPU',server.cpu],[' 💾','RAM',server.ram],['💿','Disk',server.disk]].map(([icon, label, val]) => (
          <div className="srv-mini-metric" key={label}>
            <span>{icon} {label}</span>
            <div className="srv-mini-bar"><div style={{ width: `${val}%`, background: val > 80 ? '#ef4444' : val > 60 ? '#f59e0b' : '#22c55e' }} /></div>
            <span className="srv-mini-val">{val}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const ServersPage = () => {
  const navigate = useNavigate();
  const { current, agents } = useMetrics();
  const [filter, setFilter] = useState('all');

  // Build real server entry from live data
  const realScore = useMemo(() => {
    if (!current) return 0;
    return computeHealthScore(current).score;
  }, [current]);

  const realServer = useMemo(() => {
    return {
      id: 'local',
      name: 'localhost',
      hostname: window.location.hostname,
      ip: '127.0.0.1',
      os: current?.os?.distro || 'Local OS',
      role: 'Primary Monitor',
      cpu:  Math.round(current?.cpu?.usage ?? 0),
      ram:  Math.round(current?.memory?.usagePercent ?? 0),
      disk: Math.round(current?.disks?.[0]?.usagePercent ?? 0),
      temp: Math.round(current?.temperatures?.[0]?.main ?? 40),
      uptime: current?.os ? formatUptime(current.os.uptime) : '—',
      status: realScore >= 80 ? 'online' : realScore >= 60 ? 'warning' : 'critical',
      services: current?.services?.length ?? 0,
      score: realScore,
      isLive: true,
    };
  }, [current, realScore]);

  // Convert active agent metrics map to server list
  const remoteServers = useMemo(() => {
    return Object.keys(agents).map((key) => {
      const ag = agents[key];
      const score = fakeScore({
        cpu: ag.cpu?.usage ?? 0,
        ram: ag.memory?.usagePercent ?? 0,
        disk: ag.disks?.[0]?.usagePercent ?? 0
      });
      return {
        id: ag.id || key,
        name: ag.name || key,
        hostname: ag.hostname || 'remote',
        ip: ag.ip || '0.0.0.0',
        os: ag.os?.distro || 'Linux',
        role: 'Remote Server Agent',
        cpu: Math.round(ag.cpu?.usage ?? 0),
        ram: Math.round(ag.memory?.usagePercent ?? 0),
        disk: Math.round(ag.disks?.[0]?.usagePercent ?? 0),
        uptime: ag.os?.uptime ? formatUptime(ag.os.uptime) : '—',
        status: ag.status || 'online',
        score,
        isAgent: true
      };
    });
  }, [agents]);

  const allServers = useMemo(() => {
    // If no agents are connected, keep the demo servers visible so the UI looks complete
    const showDemo = remoteServers.length === 0;
    return [
      realServer,
      ...remoteServers,
      ...(showDemo ? DEMO_SERVERS.map((s) => ({ ...s, score: fakeScore(s) })) : [])
    ];
  }, [realServer, remoteServers]);

  const filters = ['all', 'online', 'warning', 'critical'];
  const displayed = filter === 'all' ? allServers : allServers.filter((s) => s.status === filter || (filter === 'warning' && s.status === 'warning'));

  const counts = {
    all: allServers.length,
    online: allServers.filter(s => s.status === 'online').length,
    warning: allServers.filter(s => s.status === 'warning' || s.status === 'degraded').length,
    critical: allServers.filter(s => s.status === 'critical').length
  };

  return (
    <PageLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">🖥️ Servers</h1>
          <p className="page-sub">{allServers.length} monitored servers · {counts.online} online · {counts.warning} degraded · {counts.critical} critical</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {filters.map((f) => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="filter-tab-count">{counts[f] || 0}</span>
          </button>
        ))}
      </div>

      {/* Server grid */}
      <div className="srv-grid">
        {displayed.map((s) => (
          <ServerCard key={s.id} server={s} onClick={() => navigate(`/servers/${s.id}`)} />
        ))}
      </div>
    </PageLayout>
  );
};

const formatUptime = (seconds) => {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
};

export default ServersPage;

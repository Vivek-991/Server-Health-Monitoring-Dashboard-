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

  // State for Add Server Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServerName, setNewServerName] = useState('aws-ec2-instance-01');
  const [selectedOS, setSelectedOS] = useState('linux');
  const [copied, setCopied] = useState(null);

  // Compute live backend URL base (e.g. https://your-backend.onrender.com)
  const backendBaseUrl = useMemo(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    return apiUrl.replace(/\/api\/?$/, '');
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div>
          <h1 className="page-title">🖥️ Servers</h1>
          <p className="page-sub">{allServers.length} monitored servers · {counts.online} online · {counts.warning} degraded · {counts.critical} critical</p>
        </div>
        <button 
          className="btn-primary" 
          onClick={() => setShowAddModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: 'var(--text-sm)' }}
        >
          ➕ Add Server
        </button>
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

      {/* Add Server Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box modal-box-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🖥️ Connect a New Server</span>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: '16px', textAlign: 'left', lineHeight: '1.5' }}>
              Deploy the ServerPulse agent on your server in minutes to start tracking CPU, RAM, Disk, and network bandwidth in real-time.
            </p>

            <div className="modal-field">
              <label htmlFor="server-name-input">1. Name Your Server</label>
              <input
                id="server-name-input"
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                placeholder="e.g. aws-web-prod"
                style={{ marginBottom: '12px' }}
              />
            </div>

            <label style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--color-text-secondary)', textTransform: 'uppercase', display: 'block', textAlign: 'left', marginTop: '12px' }}>
              2. Select Operating System
            </label>
            <div className="add-server-tabs">
              <button className={`add-server-tab ${selectedOS === 'linux' ? 'active' : ''}`} onClick={() => setSelectedOS('linux')}>🐧 Linux / AWS EC2</button>
              <button className={`add-server-tab ${selectedOS === 'windows' ? 'active' : ''}`} onClick={() => setSelectedOS('windows')}>🪟 Windows</button>
              <button className={`add-server-tab ${selectedOS === 'macos' ? 'active' : ''}`} onClick={() => setSelectedOS('macos')}>🍏 macOS</button>
            </div>

            <div className="step-list">
              {selectedOS === 'linux' && (
                <>
                  <div className="step-item">
                    <span className="step-number">1</span>
                    <div className="step-content">
                      <h4>Install Prerequisites</h4>
                      <p>Ensure Python 3 and pip are installed, then install dependencies:</p>
                      <div className="code-block-wrapper">
                        <pre className="code-block">sudo apt update && sudo apt install python3 python3-pip -y && pip3 install psutil requests</pre>
                        <div className="code-block-actions">
                          <button className="copy-btn" onClick={() => handleCopy('sudo apt update && sudo apt install python3 python3-pip -y && pip3 install psutil requests', 'prereq')}>
                            {copied === 'prereq' ? '✅ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="step-item">
                    <span className="step-number">2</span>
                    <div className="step-content">
                      <h4>Run the Automatic Setup (Foreground Test)</h4>
                      <p>Download the script and start it directly to verify connection:</p>
                      <div className="code-block-wrapper">
                        <pre className="code-block">{`curl -s -O ${backendBaseUrl}/agent.py && env SERVERPULSE_ID="${newServerName}" SERVERPULSE_KEY="default-secure-key-123" SERVERPULSE_URL="${backendBaseUrl}/api/metrics/push" python3 agent.py`}</pre>
                        <div className="code-block-actions">
                          <button className="copy-btn" onClick={() => handleCopy(`curl -s -O ${backendBaseUrl}/agent.py && env SERVERPULSE_ID="${newServerName}" SERVERPULSE_KEY="default-secure-key-123" SERVERPULSE_URL="${backendBaseUrl}/api/metrics/push" python3 agent.py`, 'run')}>
                            {copied === 'run' ? '✅ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="step-item">
                    <span className="step-number">3</span>
                    <div className="step-content">
                      <h4>Run in Background (Production)</h4>
                      <p>Use nohup to keep the agent active in the background after you log out of SSH:</p>
                      <div className="code-block-wrapper">
                        <pre className="code-block">{`nohup env SERVERPULSE_ID="${newServerName}" SERVERPULSE_KEY="default-secure-key-123" SERVERPULSE_URL="${backendBaseUrl}/api/metrics/push" python3 agent.py > agent.log 2>&1 &`}</pre>
                        <div className="code-block-actions">
                          <button className="copy-btn" onClick={() => handleCopy(`nohup env SERVERPULSE_ID="${newServerName}" SERVERPULSE_KEY="default-secure-key-123" SERVERPULSE_URL="${backendBaseUrl}/api/metrics/push" python3 agent.py > agent.log 2>&1 &`, 'bg')}>
                            {copied === 'bg' ? '✅ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedOS === 'windows' && (
                <>
                  <div className="step-item">
                    <span className="step-number">1</span>
                    <div className="step-content">
                      <h4>Download the Agent Script</h4>
                      <p>Run this in PowerShell to fetch the agent script from your dashboard:</p>
                      <div className="code-block-wrapper">
                        <pre className="code-block">{`Invoke-WebRequest -Uri "${backendBaseUrl}/agent.py" -OutFile "agent.py"`}</pre>
                        <div className="code-block-actions">
                          <button className="copy-btn" onClick={() => handleCopy(`Invoke-WebRequest -Uri "${backendBaseUrl}/agent.py" -OutFile "agent.py"`, 'win-dl')}>
                            {copied === 'win-dl' ? '✅ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="step-item">
                    <span className="step-number">2</span>
                    <div className="step-content">
                      <h4>Install Dependencies & Start Agent</h4>
                      <p>Install modules, set configuration, and start the python agent:</p>
                      <div className="code-block-wrapper">
                        <pre className="code-block">{`pip install psutil requests; $env:SERVERPULSE_ID="${newServerName}"; $env:SERVERPULSE_KEY="default-secure-key-123"; $env:SERVERPULSE_URL="${backendBaseUrl}/api/metrics/push"; python agent.py`}</pre>
                        <div className="code-block-actions">
                          <button className="copy-btn" onClick={() => handleCopy(`pip install psutil requests; $env:SERVERPULSE_ID="${newServerName}"; $env:SERVERPULSE_KEY="default-secure-key-123"; $env:SERVERPULSE_URL="${backendBaseUrl}/api/metrics/push"; python agent.py`, 'win-run')}>
                            {copied === 'win-run' ? '✅ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedOS === 'macos' && (
                <>
                  <div className="step-item">
                    <span className="step-number">1</span>
                    <div className="step-content">
                      <h4>Install Prerequisites</h4>
                      <p>Install the required Python modules:</p>
                      <div className="code-block-wrapper">
                        <pre className="code-block">pip3 install psutil requests</pre>
                        <div className="code-block-actions">
                          <button className="copy-btn" onClick={() => handleCopy('pip3 install psutil requests', 'mac-deps')}>
                            {copied === 'mac-deps' ? '✅ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="step-item">
                    <span className="step-number">2</span>
                    <div className="step-content">
                      <h4>Download and Start the Agent</h4>
                      <p>Download the script and start it pointing to your backend:</p>
                      <div className="code-block-wrapper">
                        <pre className="code-block">{`curl -s -O ${backendBaseUrl}/agent.py && env SERVERPULSE_ID="${newServerName}" SERVERPULSE_KEY="default-secure-key-123" SERVERPULSE_URL="${backendBaseUrl}/api/metrics/push" python3 agent.py`}</pre>
                        <div className="code-block-actions">
                          <button className="copy-btn" onClick={() => handleCopy(`curl -s -O ${backendBaseUrl}/agent.py && env SERVERPULSE_ID="${newServerName}" SERVERPULSE_KEY="default-secure-key-123" SERVERPULSE_URL="${backendBaseUrl}/api/metrics/push" python3 agent.py`, 'mac-run')}>
                            {copied === 'mac-run' ? '✅ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
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

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/common/PageLayout';
import useMetrics from '../hooks/useMetrics';
import { computeHealthScore } from '../utils/healthScore';
import { deleteAgentServer, deleteAllAgentServers, serverApi } from '../api/metricsApi';
import { useAuth } from '../context/AuthContext';

// ── Score Color ──────────────────────────────────────────────────────────────
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
const ServerCard = ({ server, onClick, onRemove }) => {
  const badge  = statusBadge(server.status);
  const score  = server.score;
  const color  = scoreColor(score);
  const isOffline = server.status === 'offline';
  return (
    <div
      className="srv-card"
      onClick={onClick}
      title={`Open ${server.name}`}
      style={{ position: 'relative', opacity: isOffline ? 0.65 : 1, transition: 'opacity 0.3s ease' }}
    >
      <button
        className="srv-remove-btn"
        onClick={(e) => { e.stopPropagation(); onRemove(server.id); }}
        title={`Delete ${server.name}`}
        style={{
          position: 'absolute', top: '12px', right: '12px',
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ef4444', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: '600',
          zIndex: 10, padding: '4px 8px', borderRadius: 'var(--radius-sm)',
          transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '4px'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
      >
        🗑️ Delete
      </button>

      <div className="srv-card-top" style={{ paddingRight: '80px' }}>
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

const formatUptime = (seconds) => {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// ── Add Server Modal ─────────────────────────────────────────────────────────
const AddServerModal = ({ onClose, backendBaseUrl, currentUser }) => {
  const [step, setStep] = useState('name'); // 'name' | 'install'
  const [serverName, setServerName] = useState('my-server-01');
  const [selectedOS, setSelectedOS] = useState('linux');
  const [copied, setCopied] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdServer, setCreatedServer] = useState(null); // { id, name, apiKey }

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreateServer = useCallback(async () => {
    if (!serverName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await serverApi.create({ name: serverName.trim() });
      // res.data contains the server with its apiKey
      const server = res.data;
      // Need to fetch apiKey — regenerate to get it back (since select:false)
      const keyRes = await serverApi.regenerateKey(server._id || server.id);
      setCreatedServer({
        id: server._id || server.id,
        name: server.name,
        apiKey: keyRes.data?.apiKey || 'your-api-key',
      });
      setStep('install');
    } catch (err) {
      setCreateError(err.message || 'Failed to create server');
    } finally {
      setCreating(false);
    }
  }, [serverName]);

  const [customServerUrl, setCustomServerUrl] = useState(backendBaseUrl);
  const effectiveBaseUrl = useMemo(() => {
    return (customServerUrl || backendBaseUrl).replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }, [customServerUrl, backendBaseUrl]);

  const apiKey = createdServer?.apiKey || 'shd_YOUR_API_KEY';
  const srvId  = createdServer?.name || serverName;

  const cmd = {
    linux: {
      prereq:     `sudo apt update && sudo apt install python3 python3-pip python3-psutil python3-requests -y || pip3 install --break-system-packages psutil requests`,
      test:       `curl -fsSL ${effectiveBaseUrl}/agent.py -o agent.py && SERVERPULSE_ID="${srvId}" SERVERPULSE_KEY="${apiKey}" SERVERPULSE_URL="${effectiveBaseUrl}/api/metrics/push" python3 agent.py`,
      background: `SERVERPULSE_ID="${srvId}" SERVERPULSE_KEY="${apiKey}" SERVERPULSE_URL="${effectiveBaseUrl}/api/metrics/push" nohup python3 agent.py > agent.log 2>&1 &`,
      oneliner:   `curl -fsSL ${effectiveBaseUrl}/install.sh | sudo bash && SERVERPULSE_ID="${srvId}" SERVERPULSE_KEY="${apiKey}" SERVERPULSE_URL="${effectiveBaseUrl}/api/metrics/push" python3 /opt/serverpulse-agent.py`,
    },
    windows: {
      download: `Invoke-WebRequest -Uri "${effectiveBaseUrl}/agent.py" -OutFile "agent.py"`,
      run:      `pip install psutil requests; $env:SERVERPULSE_ID="${srvId}"; $env:SERVERPULSE_KEY="${apiKey}"; $env:SERVERPULSE_URL="${effectiveBaseUrl}/api/metrics/push"; python agent.py`,
    },
    macos: {
      prereq:     `pip3 install psutil requests`,
      test:       `curl -fsSL ${effectiveBaseUrl}/agent.py -o agent.py && SERVERPULSE_ID="${srvId}" SERVERPULSE_KEY="${apiKey}" SERVERPULSE_URL="${effectiveBaseUrl}/api/metrics/push" python3 agent.py`,
      background: `nohup SERVERPULSE_ID="${srvId}" SERVERPULSE_KEY="${apiKey}" SERVERPULSE_URL="${effectiveBaseUrl}/api/metrics/push" python3 agent.py > agent.log 2>&1 &`,
    },
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🖥️ Connect a New Server</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Step 1: Name */}
        {step === 'name' && (
          <>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: '20px', lineHeight: '1.6' }}>
              Give your server a unique name. We'll generate a secure API key for it that only <strong>{currentUser?.name || 'you'}</strong> can use.
            </p>
            <div className="modal-field">
              <label htmlFor="new-server-name">Server Name</label>
              <input
                id="new-server-name"
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                placeholder="e.g. aws-web-prod or my-vps-01"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateServer(); }}
                autoFocus
              />
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                Only letters, numbers, hyphens, and underscores. This becomes your server's identity on the dashboard.
              </p>
            </div>
            {createError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: '#ef4444', fontSize: 'var(--text-sm)', marginTop: '12px' }}>
                ⚠️ {createError}
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleCreateServer}
                disabled={creating || !serverName.trim()}
              >
                {creating ? '⏳ Creating…' : '→ Generate Install Command'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Install instructions */}
        {step === 'install' && (
          <>
            <div style={{
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px',
              display: 'flex', alignItems: 'flex-start', gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 'var(--text-sm)' }}>Server "{createdServer?.name}" created!</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Your unique API key is embedded in the commands below. Only your account can see this server's metrics.
                </div>
              </div>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
              SSH into your server and run these commands. The agent will start pushing metrics every 5 seconds.
            </p>

            {/* Server URL Input for remote EC2 / VPS */}
            <div style={{
              background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '16px'
            }}>
              <label htmlFor="custom-server-url" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-primary)', display: 'block', marginBottom: '6px' }}>
                🌐 Dashboard Backend URL (for Remote EC2 / VPS):
              </label>
              <input
                id="custom-server-url"
                type="text"
                value={customServerUrl}
                onChange={(e) => setCustomServerUrl(e.target.value)}
                placeholder="e.g. https://xxx.ngrok-free.app or http://YOUR_BACKEND_PUBLIC_IP:5000"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)', fontSize: 'var(--text-xs)', fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                💡 If testing AWS EC2 locally, expose port 5000 using <code>npx ngrok http 5000</code> and paste the ngrok URL here. The commands below will auto-update!
              </div>
            </div>

            {/* OS tabs */}
            <div className="add-server-tabs" style={{ marginBottom: '16px' }}>
              <button className={`add-server-tab ${selectedOS === 'linux'   ? 'active' : ''}`} onClick={() => setSelectedOS('linux')}>🐧 Linux / AWS EC2</button>
              <button className={`add-server-tab ${selectedOS === 'windows' ? 'active' : ''}`} onClick={() => setSelectedOS('windows')}>🪟 Windows</button>
              <button className={`add-server-tab ${selectedOS === 'macos'   ? 'active' : ''}`} onClick={() => setSelectedOS('macos')}>🍏 macOS</button>
            </div>

            <div className="step-list">
              {selectedOS === 'linux' && (
                <>
                  <CodeStep n={1} title="One-liner Install (Fastest)" desc="One command to install everything and start monitoring:">
                    <CodeBlock text={cmd.linux.oneliner} id="oneliner" copied={copied} onCopy={handleCopy} />
                  </CodeStep>
                  <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', margin: '4px 0' }}>— or manually —</div>
                  <CodeStep n={2} title="Step 1 — Install Prerequisites" desc="Install Python 3 and required libraries:">
                    <CodeBlock text={cmd.linux.prereq} id="prereq" copied={copied} onCopy={handleCopy} />
                  </CodeStep>
                  <CodeStep n={3} title="Step 2 — Download & Test" desc="Download the agent and verify it connects:">
                    <CodeBlock text={cmd.linux.test} id="test" copied={copied} onCopy={handleCopy} />
                  </CodeStep>
                  <CodeStep n={4} title="Step 3 — Run in Background" desc="Keep monitoring after you close SSH (use nohup):">
                    <CodeBlock text={cmd.linux.background} id="bg" copied={copied} onCopy={handleCopy} />
                  </CodeStep>
                </>
              )}

              {selectedOS === 'windows' && (
                <>
                  <CodeStep n={1} title="Download the Agent (PowerShell)" desc="Run this in PowerShell as Administrator:">
                    <CodeBlock text={cmd.windows.download} id="win-dl" copied={copied} onCopy={handleCopy} />
                  </CodeStep>
                  <CodeStep n={2} title="Install Dependencies & Start" desc="Install libraries, configure, and start the agent:">
                    <CodeBlock text={cmd.windows.run} id="win-run" copied={copied} onCopy={handleCopy} />
                  </CodeStep>
                </>
              )}

              {selectedOS === 'macos' && (
                <>
                  <CodeStep n={1} title="Install Prerequisites" desc="Install Python dependencies:">
                    <CodeBlock text={cmd.macos.prereq} id="mac-deps" copied={copied} onCopy={handleCopy} />
                  </CodeStep>
                  <CodeStep n={2} title="Download & Test" desc="Download and run the agent:">
                    <CodeBlock text={cmd.macos.test} id="mac-test" copied={copied} onCopy={handleCopy} />
                  </CodeStep>
                  <CodeStep n={3} title="Run in Background" desc="Keep running after terminal closes:">
                    <CodeBlock text={cmd.macos.background} id="mac-bg" copied={copied} onCopy={handleCopy} />
                  </CodeStep>
                </>
              )}
            </div>

            <div style={{
              background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
              padding: '12px 16px', marginTop: '12px', fontSize: 'var(--text-xs)',
              color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div>💡 <strong>Tip:</strong> Once the agent starts, your server will appear on this page within 10 seconds. No page refresh needed.</div>
              <div>☁️ <strong>Connecting AWS EC2 to Localhost Backend:</strong> Since AWS EC2 cannot reach <code>localhost:5000</code> on your machine, expose your local port 5000 using <code>npx ngrok http 5000</code> or <code>npx localtunnel --port 5000</code>. Then replace <code>localhost:5000</code> in <code>SERVERPULSE_URL</code> on EC2 with your ngrok URL (e.g. <code>https://xxx.ngrok-free.app/api/metrics/push</code>).</div>
            </div>

            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button className="btn-secondary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Helper sub-components ─────────────────────────────────────────────────────
const CodeStep = ({ n, title, desc, children }) => (
  <div className="step-item">
    <span className="step-number">{n}</span>
    <div className="step-content">
      <h4>{title}</h4>
      <p>{desc}</p>
      {children}
    </div>
  </div>
);

const CodeBlock = ({ text, id, copied, onCopy }) => (
  <div className="code-block-wrapper">
    <pre className="code-block">{text}</pre>
    <div className="code-block-actions">
      <button className="copy-btn" onClick={() => onCopy(text, id)}>
        {copied === id ? '✅ Copied!' : '📋 Copy'}
      </button>
    </div>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const ServersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agents } = useMetrics();
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const backendBaseUrl = useMemo(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    return apiUrl.replace(/\/api\/?$/, '');
  }, []);

  const handleRemoveServer = async (serverId) => {
    if (!window.confirm(`Delete server "${serverId}"?\n\nMake sure to stop the agent.py script on that server first.`)) return;
    try {
      await deleteAgentServer(serverId);
    } catch (err) {
      alert(`Failed to remove server: ${err.message}`);
    }
  };

  const handleRemoveAllServers = async () => {
    if (!window.confirm('Remove ALL servers from your monitoring list?')) return;
    try {
      await deleteAllAgentServers();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  };

  // Convert active agent metrics map to display list
  const remoteServers = useMemo(() => {
    return Object.keys(agents).map((key) => {
      const ag = agents[key];
      const isOffline = ag.status === 'offline';
      const rawScore = computeHealthScore(ag).score;
      const score = isOffline ? 0 : rawScore;
      return {
        id:       ag.id || key,
        name:     ag.name || key,
        hostname: ag.hostname || 'remote',
        ip:       ag.ip || '—',
        os:       ag.os?.distro || 'Linux',
        role:     'Remote Agent',
        cpu:      isOffline ? 0 : Math.round(ag.cpu?.usage ?? 0),
        ram:      isOffline ? 0 : Math.round(ag.memory?.usagePercent ?? 0),
        disk:     isOffline ? 0 : Math.round(ag.disks?.[0]?.usagePercent ?? 0),
        uptime:   isOffline ? '—' : (ag.os?.uptime ? formatUptime(ag.os.uptime) : '—'),
        status:   ag.status || 'online',
        score,
        isAgent: true,
      };
    });
  }, [agents]);

  const allServers = remoteServers;

  const filters = ['all', 'online', 'warning', 'critical', 'offline'];
  const displayed = filter === 'all' ? allServers : allServers.filter((s) => s.status === filter);

  const counts = {
    all:      allServers.length,
    online:   allServers.filter(s => s.status === 'online').length,
    warning:  allServers.filter(s => s.status === 'warning' || s.status === 'degraded').length,
    critical: allServers.filter(s => s.status === 'critical').length,
    offline:  allServers.filter(s => s.status === 'offline').length,
  };

  return (
    <PageLayout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div>
          <h1 className="page-title">🖥️ My Servers</h1>
          <p className="page-sub">
            {allServers.length} servers monitored &nbsp;·&nbsp;
            <span style={{ color: '#22c55e' }}>{counts.online} online</span> &nbsp;·&nbsp;
            <span style={{ color: '#f59e0b' }}>{counts.warning} degraded</span> &nbsp;·&nbsp;
            <span style={{ color: '#ef4444' }}>{counts.critical} critical</span> &nbsp;·&nbsp;
            <span style={{ color: '#888' }}>{counts.offline} offline</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {allServers.length > 0 && (
            <button
              onClick={handleRemoveAllServers}
              style={{
                background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 16px',
                borderRadius: 'var(--radius-md)', fontWeight: '600',
                fontSize: 'var(--text-sm)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              🗑️ Clear All
            </button>
          )}
          <button
            className="btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: 'var(--text-sm)' }}
          >
            ➕ Add Server
          </button>
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
      {displayed.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)',
          margin: '24px 0'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖥️</div>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: '8px' }}>
            {filter === 'all' ? 'No Servers Connected Yet' : `No ${filter} servers`}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '450px', margin: '0 auto 20px', lineHeight: '1.6' }}>
            {filter === 'all'
              ? 'Click "Add Server" to get a ready-to-run install command for your Linux, Windows, or macOS server.'
              : `You have no servers with "${filter}" status.`}
          </p>
          {filter === 'all' && (
            <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ padding: '10px 20px', fontSize: 'var(--text-sm)' }}>
              ➕ Add Your First Server
            </button>
          )}
        </div>
      ) : (
        <div className="srv-grid">
          {displayed.map((s) => (
            <ServerCard key={s.id} server={s} onClick={() => navigate(`/servers/${s.id}`)} onRemove={handleRemoveServer} />
          ))}
        </div>
      )}

      {/* Add Server Modal */}
      {showAddModal && (
        <AddServerModal
          onClose={() => setShowAddModal(false)}
          backendBaseUrl={backendBaseUrl}
          currentUser={user}
        />
      )}
    </PageLayout>
  );
};

export default ServersPage;

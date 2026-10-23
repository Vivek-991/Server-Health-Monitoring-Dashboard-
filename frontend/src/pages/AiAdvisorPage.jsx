import React, { useState, useEffect, useMemo, useRef } from 'react';
import PageLayout from '../components/common/PageLayout';
import useMetrics from '../hooks/useMetrics';
import { aiApi } from '../api/metricsApi';
import { formatBytes } from '../utils/formatters';
import Loader from '../components/common/Loader';
import '../styles/ai.css';

const CATEGORIES = [
  { id: 'all', label: 'All Recommendations', icon: '⚡' },
  { id: 'performance', label: 'Performance', icon: '🚀' },
  { id: 'storage', label: 'Storage', icon: '💿' },
  { id: 'reliability', label: 'Reliability', icon: '⚙️' },
  { id: 'security', label: 'Security', icon: '🛡️' },
];

const PROMPT_SUGGESTIONS = [
  '⚡ Run full diagnostic assessment',
  '💾 How do I reduce RAM usage safely?',
  '💿 Find largest disk files & clear space',
  '🚀 Optimize swappiness & kernel performance',
  '🛡️ Audit listening ports and firewall',
  '📄 Generate SRE incident summary report',
];

const AiAdvisorPage = () => {
  const { agents = {}, current, loading: metricsLoading } = useMetrics();

  // Server selection
  const remoteServerList = useMemo(() => {
    return Object.keys(agents).map((key) => {
      const ag = agents[key];
      return {
        id: ag.id || key,
        name: ag.name || key,
        hostname: ag.hostname || key,
        ip: ag.ip || '—',
        status: ag.status || 'online',
        metrics: ag,
      };
    });
  }, [agents]);

  const [selectedServerId, setSelectedServerId] = useState('');

  const activeServer = useMemo(() => {
    if (!remoteServerList.length) {
      if (current) {
        return {
          id: 'primary-node',
          name: 'Primary Node',
          hostname: 'localhost',
          ip: '127.0.0.1',
          status: 'online',
          metrics: current,
        };
      }
      return null;
    }
    const found = remoteServerList.find((s) => s.id === selectedServerId);
    return found || remoteServerList[0];
  }, [remoteServerList, selectedServerId, current]);

  // Diagnosis State
  const [diagnosis, setDiagnosis] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

  // Chat State
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your **MonitorX AI SRE Copilot**. I analyze live telemetry, identify resource bottlenecks, and supply copyable terminal remediation playbooks.\n\nHow can I assist your infrastructure today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Playbook Modal State
  const [playbookModal, setPlaybookModal] = useState({ open: false, title: '', content: '', loading: false });

  // Settings Modal State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState({ provider: 'builtin', apiKey: '', geminiModel: 'gemini-2.5-flash', openaiModel: 'gpt-4o-mini' });
  const [configSaving, setConfigSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Load diagnosis whenever active server changes
  useEffect(() => {
    if (activeServer) {
      runDiagnosis();
    }
  }, [activeServer?.id]);

  // Load AI configuration on mount
  useEffect(() => {
    aiApi.getConfig()
      .then((res) => {
        if (res.success && res.config) {
          setAiConfig((prev) => ({
            ...prev,
            provider: res.config.provider || 'builtin',
            geminiModel: res.config.geminiModel || 'gemini-2.5-flash',
            openaiModel: res.config.openaiModel || 'gpt-4o-mini',
            maskedApiKey: res.config.maskedApiKey || '',
            hasApiKey: res.config.hasApiKey,
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Run Diagnosis
  const runDiagnosis = async () => {
    if (!activeServer) return;
    setDiagnosing(true);
    try {
      const payload = {
        serverId: activeServer.id,
        serverContext: activeServer.metrics || {},
      };
      const res = await aiApi.diagnose(payload);
      if (res.success && res.data) {
        setDiagnosis(res.data);
      }
    } catch (err) {
      console.error('Diagnosis error:', err);
    } finally {
      setDiagnosing(false);
    }
  };

  // Send Chat message
  const handleSendMessage = async (customPrompt) => {
    const text = customPrompt || inputMessage;
    if (!text.trim() || chatLoading) return;

    const userMsg = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!customPrompt) setInputMessage('');
    setChatLoading(true);

    try {
      const payload = {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        serverId: activeServer?.id,
        serverContext: activeServer?.metrics || {},
      };
      const res = await aiApi.chat(payload);
      if (res.success && res.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.message.content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Failed to receive response: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Copy command helper
  const handleCopy = (id, command) => {
    navigator.clipboard.writeText(command);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Ask AI to explain command
  const handleExplain = (rec) => {
    const prompt = `Please explain this command and why it is recommended for ${activeServer?.name}:\n\`${rec.command}\`\nContext: ${rec.title} (${rec.description})`;
    handleSendMessage(prompt);
  };

  // Generate remediation playbook
  const handleGeneratePlaybook = async (issueType) => {
    setPlaybookModal({ open: true, title: issueType, content: '', loading: true });
    try {
      const res = await aiApi.remediation({
        issueType,
        serverId: activeServer?.id,
        serverContext: activeServer?.metrics || {},
      });
      if (res.success && res.data) {
        setPlaybookModal({
          open: true,
          title: issueType,
          content: res.data.playbook,
          loading: false,
        });
      }
    } catch (err) {
      setPlaybookModal({
        open: true,
        title: issueType,
        content: `Failed to generate playbook: ${err.message}`,
        loading: false,
      });
    }
  };

  // Save AI Config
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      const res = await aiApi.updateConfig({
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        geminiModel: aiConfig.geminiModel,
        openaiModel: aiConfig.openaiModel,
      });
      if (res.success) {
        setAiConfig((prev) => ({
          ...prev,
          apiKey: '',
          hasApiKey: res.config.hasApiKey,
          maskedApiKey: res.config.maskedApiKey,
        }));
        setTestResult({ success: true, message: 'Settings saved successfully!' });
        setTimeout(() => setSettingsModalOpen(false), 1200);
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setConfigSaving(false);
    }
  };

  // Test AI Connection
  const handleTestConnection = async () => {
    setTestResult({ loading: true, message: 'Testing connection...' });
    try {
      const res = await aiApi.testConnection({
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey || undefined,
      });
      setTestResult({ success: res.success, message: res.message });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
  };

  if (metricsLoading && !activeServer) {
    return (
      <PageLayout>
        <Loader message="Initializing AI SRE Copilot..." />
      </PageLayout>
    );
  }

  const m = activeServer?.metrics || {};
  const isOffline = activeServer?.status === 'offline';
  const cpuVal = isOffline ? 0 : (m.cpu?.usage ?? 0);
  const ramVal = isOffline ? 0 : (m.memory?.usagePercent ?? 0);
  const primaryDisk = (m.disks || m.disk || []).find((d) => !d.mount?.startsWith('/snap')) || {};
  const diskVal = isOffline ? 0 : (primaryDisk.usagePercent ?? 0);

  // Filter recommendations
  const filteredRecs = (diagnosis?.recommendations || []).filter((r) => {
    if (activeCategory === 'all') return true;
    return r.category?.toLowerCase() === activeCategory;
  });

  const score = diagnosis?.healthScore ?? 100;
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <PageLayout>
      <div className="ai-page">
        {/* ── Top Header ────────────────────────────────────────────────────── */}
        <div className="ai-header">
          <div className="ai-header-left">
            <div className="ai-icon-badge">🤖</div>
            <div>
              <h1 className="ai-header-title">
                AI SRE Advisor & Systems Agent
                <span className="ai-engine-pill">
                  <span className="ai-engine-dot" />
                  {diagnosis?.engine ? diagnosis.engine.toUpperCase() : 'BUILTIN-SRE'}
                </span>
              </h1>
              <p className="ai-header-subtitle">
                Real-time autonomous telemetry diagnosis, predictive incident prevention & interactive shell playbooks
              </p>
            </div>
          </div>

          <div className="ai-header-actions">
            {/* Server Selector */}
            {remoteServerList.length > 0 && (
              <select
                value={activeServer?.id || ''}
                onChange={(e) => setSelectedServerId(e.target.value)}
                style={{
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  padding: '9px 14px',
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
            )}

            {/* Re-analyze Button */}
            <button
              onClick={runDiagnosis}
              disabled={diagnosing}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {diagnosing ? 'Analyzing...' : '⚡ Re-analyze System'}
            </button>

            {/* Settings Trigger */}
            <button
              onClick={() => {
                setTestResult(null);
                setSettingsModalOpen(true);
              }}
              className="btn btn-secondary"
              title="AI Agent Settings"
              style={{
                padding: '9px 14px',
                borderRadius: 'var(--radius-md)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              ⚙️ AI Settings
            </button>
          </div>
        </div>

        {/* ── Mini Real-Time Telemetry Bar ──────────────────────────────────── */}
        <div className="ai-metrics-bar">
          <div className="ai-metric-mini-card">
            <span className="ai-metric-mini-label">Target Node</span>
            <span className="ai-metric-mini-value" style={{ fontSize: '0.9rem' }}>
              {activeServer?.name || 'Localhost'}
            </span>
          </div>
          <div className="ai-metric-mini-card">
            <span className="ai-metric-mini-label">Status</span>
            <span
              className="ai-metric-mini-value"
              style={{ color: isOffline ? '#ef4444' : '#22c55e', textTransform: 'uppercase' }}
            >
              {activeServer?.status || 'ONLINE'}
            </span>
          </div>
          <div className="ai-metric-mini-card">
            <span className="ai-metric-mini-label">CPU Usage</span>
            <span className="ai-metric-mini-value" style={{ color: cpuVal > 80 ? '#ef4444' : '#38bdf8' }}>
              {cpuVal.toFixed(1)}%
            </span>
          </div>
          <div className="ai-metric-mini-card">
            <span className="ai-metric-mini-label">Memory</span>
            <span className="ai-metric-mini-value" style={{ color: ramVal > 85 ? '#ef4444' : '#a855f7' }}>
              {ramVal.toFixed(1)}%
            </span>
          </div>
          <div className="ai-metric-mini-card">
            <span className="ai-metric-mini-label">Disk Storage</span>
            <span className="ai-metric-mini-value" style={{ color: diskVal > 85 ? '#ef4444' : '#f59e0b' }}>
              {diskVal.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* ── Diagnosis Hero Banner ─────────────────────────────────────────── */}
        <div className="ai-diagnosis-banner">
          <div className="ai-score-ring-wrap">
            <div className="ai-score-circle" style={{ borderColor: scoreColor }}>
              <span className="ai-score-number" style={{ color: scoreColor }}>
                {score}
              </span>
              <span className="ai-score-sub">AI Health Score</span>
            </div>
            <div
              style={{
                marginTop: '10px',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: scoreColor,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {diagnosis?.riskLevel || 'LOW'} RISK
            </div>
          </div>

          <div className="ai-diagnosis-content">
            <h3>
              <span>🛡️ Autonomous SRE Health Verdict</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                }}
              >
                Evaluated {new Date().toLocaleTimeString()}
              </span>
            </h3>
            <p className="ai-diagnosis-summary">
              {diagnosis?.summary || 'Analyzing server metrics and identifying actionable optimizations...'}
            </p>

            <div className="ai-anomalies-list">
              {diagnosis?.anomalies && diagnosis.anomalies.length > 0 ? (
                diagnosis.anomalies.map((ano, idx) => (
                  <span
                    key={idx}
                    className={`ai-anomaly-tag ${ano.toLowerCase().includes('no critical') ? 'clean' : ''}`}
                  >
                    {ano.toLowerCase().includes('no critical') ? '✅' : '⚠️'} {ano}
                  </span>
                ))
              ) : (
                <span className="ai-anomaly-tag clean">✅ Telemetry nominal across all subsystems</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Two Column Workspace: Recommendations + Interactive Chat ──────── */}
        <div className="ai-workspace-grid">
          {/* Column 1: Actionable Recommendations */}
          <div>
            <div className="ai-section-title">
              <span>🎯 Prioritized Recommendations ({filteredRecs.length})</span>
              <button
                onClick={() => handleGeneratePlaybook('Comprehensive System Cleanup')}
                className="btn btn-secondary"
                style={{ fontSize: 'var(--text-xs)', padding: '5px 10px', borderRadius: 'var(--radius-sm)' }}
              >
                📜 Run Auto-Playbook
              </button>
            </div>

            {/* Category Filters */}
            <div className="ai-filter-bar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`ai-filter-chip ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* Recommendation Cards */}
            {filteredRecs.length === 0 ? (
              <div
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-8)',
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
                <h4 style={{ margin: 0, color: 'var(--color-text-primary)' }}>No active issues in this category</h4>
                <p style={{ fontSize: 'var(--text-sm)', marginTop: '4px' }}>
                  {activeServer?.name} is healthy with no high-priority bottlenecks detected.
                </p>
              </div>
            ) : (
              filteredRecs.map((rec) => {
                const isCopied = copiedId === rec.id;
                return (
                  <div key={rec.id} className={`ai-rec-card ${rec.severity || 'optimization'}`}>
                    <div className="ai-rec-header">
                      <h4 className="ai-rec-title">{rec.title}</h4>
                      <span className={`ai-badge ${rec.severity || 'optimization'}`}>
                        {rec.severity || 'optimization'}
                      </span>
                    </div>

                    <p className="ai-rec-desc">{rec.description}</p>

                    <div className="ai-rec-meta">
                      {rec.impact && <span>💥 Impact: {rec.impact}</span>}
                      {rec.effort && <span>⏱️ Effort: {rec.effort}</span>}
                      {rec.category && <span>🏷️ {rec.category.toUpperCase()}</span>}
                    </div>

                    {rec.command && (
                      <div className="ai-command-box">
                        <span className="ai-command-text">{rec.command}</span>
                        <div className="ai-command-actions">
                          <button
                            className={`ai-copy-btn ${isCopied ? 'copied' : ''}`}
                            onClick={() => handleCopy(rec.id, rec.command)}
                            title="Copy bash command"
                          >
                            {isCopied ? '✓ Copied' : '📋 Copy'}
                          </button>
                          <button
                            className="ai-explain-btn"
                            onClick={() => handleExplain(rec)}
                            title="Ask AI to explain command"
                          >
                            ❓ Explain
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Column 2: Interactive AI SRE Chat Console */}
          <div>
            <div className="ai-section-title">
              <span>💬 Interactive SRE Console</span>
              <button
                onClick={() =>
                  setMessages([
                    {
                      role: 'assistant',
                      content: `Chat cleared. Telemetry for **${activeServer?.name}** is live in context. How can I help?`,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ])
                }
                className="ai-icon-btn"
                title="Clear Chat"
              >
                🗑️
              </button>
            </div>

            <div className="ai-chat-card">
              {/* Chat Header */}
              <div className="ai-chat-header">
                <div className="ai-chat-title">
                  <span>🤖</span>
                  <span>SRE Copilot</span>
                </div>
                <div className="ai-chat-telemetry-pill">
                  📡 {activeServer?.name} Attached
                </div>
              </div>

              {/* Chat Messages */}
              <div className="ai-chat-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`ai-message ${msg.role}`}>
                    <div className={`ai-avatar ${msg.role === 'user' ? 'user-avatar' : ''}`}>
                      {msg.role === 'user' ? '👤' : '🤖'}
                    </div>
                    <div className="ai-bubble">
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                      <div
                        style={{
                          fontSize: '0.65rem',
                          color: 'var(--color-text-muted)',
                          marginTop: '6px',
                          textAlign: msg.role === 'user' ? 'right' : 'left',
                        }}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="ai-message assistant">
                    <div className="ai-avatar">🤖</div>
                    <div className="ai-bubble ai-typing-indicator">
                      <span className="ai-typing-dot" />
                      <span className="ai-typing-dot" />
                      <span className="ai-typing-dot" />
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Prompt Chips */}
              <div className="ai-prompt-chips">
                {PROMPT_SUGGESTIONS.map((p, idx) => (
                  <button
                    key={idx}
                    className="ai-prompt-chip"
                    onClick={() => handleSendMessage(p)}
                    disabled={chatLoading}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Chat Input Bar */}
              <form
                className="ai-chat-input-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <input
                  type="text"
                  className="ai-chat-input"
                  placeholder={`Ask SRE Agent about ${activeServer?.name || 'server'}...`}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={chatLoading}
                />
                <button type="submit" className="ai-send-btn" disabled={!inputMessage.trim() || chatLoading}>
                  Send ➔
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ── Remediation Playbook Modal ────────────────────────────────────── */}
        {playbookModal.open && (
          <div className="ai-modal-overlay" onClick={() => setPlaybookModal({ ...playbookModal, open: false })}>
            <div className="ai-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="ai-modal-header">
                <h3 className="ai-modal-title">
                  <span>🛠️</span>
                  <span>Remediation Playbook: {playbookModal.title}</span>
                </h3>
                <button
                  className="ai-icon-btn"
                  onClick={() => setPlaybookModal({ ...playbookModal, open: false })}
                >
                  ✕
                </button>
              </div>

              {playbookModal.loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <span className="ai-engine-dot" style={{ display: 'inline-block', width: '16px', height: '16px' }} />
                  <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)' }}>
                    Generating automated safe execution script...
                  </p>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      background: 'var(--color-bg-secondary)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-sm)',
                      lineHeight: '1.6',
                    }}
                  >
                    {playbookModal.content}
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(playbookModal.content);
                        alert('Playbook copied to clipboard!');
                      }}
                    >
                      📋 Copy Entire Script
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => setPlaybookModal({ ...playbookModal, open: false })}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI Provider Settings Modal ────────────────────────────────────── */}
        {settingsModalOpen && (
          <div className="ai-modal-overlay" onClick={() => setSettingsModalOpen(false)}>
            <div className="ai-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="ai-modal-header">
                <h3 className="ai-modal-title">
                  <span>⚙️</span>
                  <span>AI Agent Configuration</span>
                </h3>
                <button className="ai-icon-btn" onClick={() => setSettingsModalOpen(false)}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveConfig}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '6px' }}>
                    AI Intelligence Provider
                  </label>
                  <select
                    value={aiConfig.provider}
                    onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      outline: 'none',
                    }}
                  >
                    <option value="builtin">Built-in SRE Heuristic Engine (Offline / Zero-Config / Fast)</option>
                    <option value="gemini">Google Gemini AI (gemini-2.5-flash / gemini-1.5-flash)</option>
                    <option value="openai">OpenAI (gpt-4o-mini / gpt-4o)</option>
                  </select>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    The built-in engine provides instant deterministic diagnoses without requiring external keys.
                  </p>
                </div>

                {aiConfig.provider !== 'builtin' && (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '6px' }}>
                        {aiConfig.provider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                      </label>
                      <input
                        type="password"
                        placeholder={aiConfig.maskedApiKey ? `Configured (${aiConfig.maskedApiKey})` : 'Enter API Key...'}
                        value={aiConfig.apiKey}
                        onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                        style={{
                          width: '100%',
                          background: 'var(--color-bg-secondary)',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border)',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '6px' }}>
                        Model Selection
                      </label>
                      {aiConfig.provider === 'gemini' ? (
                        <select
                          value={aiConfig.geminiModel}
                          onChange={(e) => setAiConfig({ ...aiConfig, geminiModel: e.target.value })}
                          style={{
                            width: '100%',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            outline: 'none',
                          }}
                        >
                          <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended, Fast & Intelligent)</option>
                          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro (Deep reasoning)</option>
                        </select>
                      ) : (
                        <select
                          value={aiConfig.openaiModel}
                          onChange={(e) => setAiConfig({ ...aiConfig, openaiModel: e.target.value })}
                          style={{
                            width: '100%',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            outline: 'none',
                          }}
                        >
                          <option value="gpt-4o-mini">gpt-4o-mini (Fast & Cost Effective)</option>
                          <option value="gpt-4o">gpt-4o</option>
                        </select>
                      )}
                    </div>
                  </>
                )}

                {testResult && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      marginBottom: '16px',
                      background: testResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: testResult.success ? '#4ade80' : '#f87171',
                      border: `1px solid ${testResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    {testResult.message}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleTestConnection}
                    style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}
                  >
                    🧪 Test Connection
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSettingsModalOpen(false)}
                      style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={configSaving}
                      style={{ padding: '8px 16px', fontSize: 'var(--text-sm)', fontWeight: 700 }}
                    >
                      {configSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default AiAdvisorPage;

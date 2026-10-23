import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useMetrics from '../../hooks/useMetrics';
import { aiApi } from '../../api/metricsApi';
import '../../styles/ai.css';

const QUICK_PROMPTS = [
  '⚡ Instant server diagnosis',
  '💾 How do I reduce RAM usage?',
  '💿 How to clear disk space?',
  '🛡️ Audit open ports',
];

const AiAssistantDrawer = () => {
  const navigate = useNavigate();
  const { agents = {}, current } = useMetrics();
  const [isOpen, setIsOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(() => {
    const cached = localStorage.getItem('monitorx_ai_enabled');
    return cached === null ? true : cached === 'true';
  });

  useEffect(() => {
    aiApi.getConfig().then((res) => {
      if (res.success && res.config) {
        const isEnabled = res.config.enabled !== false;
        setAiEnabled(isEnabled);
        localStorage.setItem('monitorx_ai_enabled', String(isEnabled));
      }
    }).catch(() => {});

    const onConfigChange = (e) => {
      if (typeof e.detail?.enabled === 'boolean') {
        setAiEnabled(e.detail.enabled);
      }
    };
    window.addEventListener('ai-config-changed', onConfigChange);
    return () => window.removeEventListener('ai-config-changed', onConfigChange);
  }, []);

  // Active server resolution
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

  // Chat state
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hi! I am your **MonitorX AI Copilot**. Click **Instant Diagnose** or ask me any question about your servers, performance, or Linux commands.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickDiag, setQuickDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const chatEndRef = useRef(null);

  const handleSendRef = useRef();

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  useEffect(() => {
    const handleOpen = (e) => {
      setIsOpen(true);
      if (e.detail?.prompt) {
        setTimeout(() => {
          handleSendRef.current?.(e.detail.prompt);
        }, 150);
      }
    };
    window.addEventListener('open-ai-drawer', handleOpen);
    return () => window.removeEventListener('open-ai-drawer', handleOpen);
  }, []);

  const handleSend = async (customPrompt) => {
    const text = customPrompt || inputText;
    if (!text.trim() || loading) return;

    const userMsg = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!customPrompt) setInputText('');
    setLoading(true);

    try {
      const payload = {
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
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
          content: `⚠️ Failed to get answer: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  handleSendRef.current = handleSend;

  const handleQuickDiagnose = async () => {
    if (!activeServer || diagLoading) return;
    setDiagLoading(true);
    try {
      const res = await aiApi.diagnose({
        serverId: activeServer.id,
        serverContext: activeServer.metrics || {},
      });
      if (res.success && res.data) {
        setQuickDiag(res.data);
      }
    } catch (err) {
      console.error('Quick diagnose failed:', err);
    } finally {
      setDiagLoading(false);
    }
  };

  const m = activeServer?.metrics || {};
  const isOffline = activeServer?.status === 'offline';
  const cpuVal = isOffline ? 0 : (m.cpu?.usage ?? 0);
  const ramVal = isOffline ? 0 : (m.memory?.usagePercent ?? 0);
  const primaryDisk = (m.disks || m.disk || []).find((d) => !d.mount?.startsWith('/snap')) || {};
  const diskVal = isOffline ? 0 : (primaryDisk.usagePercent ?? 0);

  return (
    <>
      {/* ── Floating Action Trigger Button ─────────────────────────────── */}
      {!isOpen && aiEnabled && (
        <button
          className="ai-floating-trigger"
          onClick={() => setIsOpen(true)}
          title="Open AI SRE Copilot"
          aria-label="Open AI SRE Copilot"
        >
          <span>🤖 AI Copilot</span>
          <span className="ai-floating-badge">AI</span>
        </button>
      )}

      {/* ── Slide-over Drawer Panel ───────────────────────────────────── */}
      {isOpen && (
        <>
          <div className="ai-drawer-overlay" onClick={() => setIsOpen(false)} />
          <div className="ai-drawer-panel">
            {/* Disabled Notification Banner */}
            {!aiEnabled && (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  fontSize: '0.78rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>⚠️ AI Agent is currently <strong>DISABLED</strong> in Settings.</span>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/settings');
                  }}
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Enable in Settings
                </button>
              </div>
            )}
            {/* Header */}
            <div className="ai-drawer-header">
              <div className="ai-drawer-title">
                <span style={{ fontSize: '1.25rem' }}>🤖</span>
                <div>
                  <div style={{ lineHeight: 1.2 }}>AI SRE Copilot</div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                    {activeServer?.name || 'Live Telemetry'}
                  </span>
                </div>
              </div>

              <div className="ai-drawer-controls">
                <button
                  className="ai-icon-btn"
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/ai-agent');
                  }}
                  title="Open full AI Advisor page"
                >
                  ↗
                </button>
                <button
                  className="ai-icon-btn"
                  onClick={() => setIsOpen(false)}
                  title="Close AI Copilot"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Server Switch & Metrics Strip */}
            <div
              style={{
                padding: '10px 16px',
                background: 'rgba(0,0,0,0.25)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              {remoteServerList.length > 1 ? (
                <select
                  value={activeServer?.id || ''}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  style={{
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {remoteServerList.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.status === 'online' ? '🟢' : '🔴'} {srv.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  {activeServer?.name}
                </span>
              )}

              <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: cpuVal > 80 ? '#ef4444' : '#38bdf8' }}>CPU: {cpuVal.toFixed(0)}%</span>
                <span style={{ color: ramVal > 85 ? '#ef4444' : '#a855f7' }}>RAM: {ramVal.toFixed(0)}%</span>
                <span style={{ color: diskVal > 85 ? '#ef4444' : '#f59e0b' }}>DISK: {diskVal.toFixed(0)}%</span>
              </div>
            </div>

            {/* Quick Diagnose Callout */}
            <div
              style={{
                padding: '10px 16px',
                background: 'rgba(99, 132, 255, 0.08)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                {quickDiag
                  ? `Health Score: ${quickDiag.healthScore}/100 (${quickDiag.riskLevel} Risk)`
                  : 'Get instant AI analysis of active server metrics'}
              </span>
              <button
                onClick={handleQuickDiagnose}
                disabled={diagLoading}
                className="btn btn-primary"
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'nowrap',
                }}
              >
                {diagLoading ? 'Diagnosing...' : '⚡ Instant Diagnose'}
              </button>
            </div>

            {/* Top recommendation snapshot if diagnosed */}
            {quickDiag && quickDiag.recommendations && quickDiag.recommendations.length > 0 && (
              <div
                style={{
                  padding: '10px 16px',
                  background: 'var(--color-bg-secondary)',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                  🎯 Top SRE Recommendation:
                </div>
                <div style={{ color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {quickDiag.recommendations[0].title}
                </div>
                {quickDiag.recommendations[0].command && (
                  <div
                    style={{
                      background: '#060911',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      color: '#38bdf8',
                      fontSize: '0.72rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {quickDiag.recommendations[0].command}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(quickDiag.recommendations[0].command);
                        alert('Copied command!');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-accent-blue)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        marginLeft: '8px',
                      }}
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Chat Messages */}
            <div className="ai-chat-messages" style={{ flex: 1, padding: '16px' }}>
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
                        marginTop: '4px',
                        textAlign: msg.role === 'user' ? 'right' : 'left',
                      }}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="ai-message assistant">
                  <div className="ai-avatar">🤖</div>
                  <div className="ai-bubble ai-typing-indicator">
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="ai-prompt-chips">
              {QUICK_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  className="ai-prompt-chip"
                  onClick={() => handleSend(p)}
                  disabled={loading}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              className="ai-chat-input-bar"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                type="text"
                className="ai-chat-input"
                placeholder="Ask SRE Copilot..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="ai-send-btn" disabled={!inputText.trim() || loading}>
                ➔
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
};

export default AiAssistantDrawer;

import React from 'react';
import { useAlerts } from '../../context/AlertsContext';

const relTime = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

const SEVERITY_CONFIG = {
  critical: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  text: '#ef4444', dot: '#ef4444' },
  warning:  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#f59e0b', dot: '#f59e0b' },
  info:     { bg: 'rgba(99,132,255,0.08)', border: 'rgba(99,132,255,0.2)', text: '#6384ff', dot: '#6384ff' },
};

const RecentAlertsCard = () => {
  const { alerts, clearAll } = useAlerts();
  const recent = alerts.slice(0, 10);

  return (
    <div
      className="metric-card"
      style={{ '--card-accent': 'linear-gradient(90deg, #ef4444, #f97316)' }}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">Recent Alerts</span>
        <div className="ra-header-right">
          {alerts.length > 0 && (
            <button className="ra-clear-btn" onClick={clearAll} title="Clear alerts">
              Clear
            </button>
          )}
          <div className="metric-card-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            🚨
          </div>
        </div>
      </div>

      {/* Summary pills */}
      {alerts.length > 0 && (
        <div className="ra-summary">
          <span className="ra-pill ra-pill--critical">
            🔴 {alerts.filter(a => a.severity === 'critical').length} Critical
          </span>
          <span className="ra-pill ra-pill--warning">
            🟡 {alerts.filter(a => a.severity === 'warning').length} Warning
          </span>
        </div>
      )}

      {/* Alert list */}
      <div className="ra-list">
        {recent.length === 0 ? (
          <div className="ra-empty">
            <span className="ra-empty-icon">✅</span>
            <span>No recent alerts — system healthy</span>
          </div>
        ) : (
          recent.map((alert) => {
            const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
            return (
              <div
                key={alert.id}
                className="ra-item animate-fade-in"
                style={{ background: cfg.bg, borderColor: cfg.border }}
              >
                <div className="ra-item-left">
                  <span className="ra-item-icon">{alert.icon}</span>
                  <div className="ra-item-body">
                    <div className="ra-item-title" style={{ color: cfg.text }}>
                      {alert.title}
                    </div>
                    <div className="ra-item-msg">{alert.message}</div>
                  </div>
                </div>
                <span className="ra-item-time">{relTime(alert.timestamp)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecentAlertsCard;

import React, { useState } from 'react';
import { useActivity } from '../../context/ActivityContext';

const relTime = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

const TYPE_COLORS = {
  auth:   '#6384ff',
  alert:  '#ef4444',
  metric: '#00d4ff',
  system: '#a855f7',
  user:   '#22c55e',
  info:   '#8892b0',
};

const FILTER_TYPES = ['all', 'auth', 'alert', 'metric', 'system'];

const ActivityLogCard = () => {
  const { logs, clearLogs } = useActivity();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.type === filter);
  const display  = filtered.slice(0, 15);

  return (
    <div
      className="metric-card"
      style={{ '--card-accent': 'linear-gradient(90deg, #a855f7, #6384ff)' }}
    >
      {/* Header */}
      <div className="metric-card-header">
        <span className="metric-card-label">Activity Log</span>
        <div className="al-header-right">
          {logs.length > 0 && (
            <button className="ra-clear-btn" onClick={clearLogs} title="Clear log">
              Clear
            </button>
          )}
          <div className="metric-card-icon" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
            📋
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="al-filters">
        {FILTER_TYPES.map((t) => (
          <button
            key={t}
            className={`al-filter-btn ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
            style={filter === t ? { color: TYPE_COLORS[t] || '#6384ff', borderColor: TYPE_COLORS[t] || '#6384ff' } : {}}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="al-timeline">
        {display.length === 0 ? (
          <div className="ra-empty">
            <span className="ra-empty-icon">📋</span>
            <span>No activity recorded yet</span>
          </div>
        ) : (
          display.map((log, i) => {
            const color = TYPE_COLORS[log.type] || TYPE_COLORS.info;
            return (
              <div key={log.id} className="al-entry animate-fade-in">
                {/* Timeline connector */}
                <div className="al-connector">
                  <div className="al-dot" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
                  {i < display.length - 1 && <div className="al-line" />}
                </div>

                <div className="al-entry-body">
                  <div className="al-entry-header">
                    <span className="al-entry-icon">{log.icon}</span>
                    <span className="al-entry-action">{log.action}</span>
                    <span className="al-entry-time">{relTime(log.timestamp)}</span>
                  </div>
                  {log.detail && (
                    <div className="al-entry-detail">{log.detail}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityLogCard;

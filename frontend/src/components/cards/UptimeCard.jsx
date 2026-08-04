import React from 'react';
import { formatUptime } from '../../utils/formatters';
import useMetrics from '../../hooks/useMetrics';
import StatusBadge from './StatusBadge';

const UptimeCard = ({ uptime: propUptime, status: propStatus }) => {
  const { uptime: contextUptime, status: contextStatus } = useMetrics();
  const rawUptime = (propUptime !== undefined && propUptime !== null && propUptime > 0) ? propUptime : contextUptime;
  const status = propStatus || contextStatus || 'online';
  const isOffline = status === 'offline';
  const uptime = isOffline ? 0 : (typeof rawUptime === 'number' && !isNaN(rawUptime) ? rawUptime : (parseFloat(rawUptime) || 0));

  const days    = Math.floor(uptime / 86400);
  const hours   = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  return (
    <div
      className="metric-card"
      style={{ '--card-accent': 'linear-gradient(90deg, #00d4ff, #6384ff)' }}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">Server Uptime</span>
        <div className="metric-card-icon" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
          ⏱️
        </div>
      </div>

      <div className="uptime-display">
        <div className="uptime-value">{formatUptime(uptime)}</div>
        <div className="uptime-label">System Running Time</div>
      </div>

      {/* Segmented display */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
        {[
          { v: days,    l: 'Days' },
          { v: hours,   l: 'Hrs' },
          { v: minutes, l: 'Min' },
          { v: seconds, l: 'Sec' },
        ].map(({ v, l }) => (
          <div key={l} style={{
            textAlign: 'center',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            minWidth: '50px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              {String(v).padStart(2, '0')}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {l}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
        <StatusBadge status={status} />
      </div>
    </div>
  );
};

export default UptimeCard;

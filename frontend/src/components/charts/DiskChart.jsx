import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import useMetrics from '../../hooks/useMetrics';
import { formatBytes, getSeverityColor } from '../../utils/formatters';

const SEVERITY_COLORS = {
  healthy:  '#22c55e',
  moderate: '#f59e0b',
  warning:  '#f97316',
  critical: '#ef4444',
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div style={{
        background: 'var(--color-bg-card)', border: '1px solid var(--color-border-strong)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px', boxShadow: 'var(--shadow-card)',
        minWidth: '160px',
      }}>
        <p style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '4px' }}>
          {d.mount}
        </p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
          Used: {formatBytes(d.used)}
        </p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
          Total: {formatBytes(d.size)}
        </p>
        <p style={{ color: SEVERITY_COLORS[d.severity], fontWeight: 700, fontSize: 'var(--text-sm)', marginTop: '4px' }}>
          {d.usagePercent}%
        </p>
      </div>
    );
  }
  return null;
};

const DiskChart = ({ metrics: propMetrics, serverId }) => {
  const contextMetrics = useMetrics(serverId);
  const metrics = propMetrics || contextMetrics.current || contextMetrics;
  const disks = propMetrics?.disks || propMetrics?.disk || contextMetrics.disks || [];

  const data = disks.map((d) => ({
    mount: d.mount || d.fs || '/',
    usagePercent: d.usagePercent ?? 0,
    used: d.used ?? 0,
    size: d.size ?? 0,
    severity: getSeverityColor(d.usagePercent ?? 0),
  }));

  return (
    <div className="chart-card" id="disk">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">💿 Disk Usage</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {disks.length} partition{disks.length !== 1 ? 's' : ''} detected
          </div>
        </div>
        {disks.length > 0 && (
          <span className="chart-card-badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            {formatBytes(disks.reduce((s, d) => s + (d.used || 0), 0))} used
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px 0', fontSize: 'var(--text-sm)' }}>
          No disk data available
        </div>
      ) : (
        <div style={{ width: '100%', height: 200, minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="mount" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="usagePercent" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={SEVERITY_COLORS[entry.severity] || '#22c55e'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Disk list below chart */}
      <div className="disk-list" style={{ marginTop: '16px' }}>
        {disks.map((d, i) => (
          <div className="disk-item" key={i}>
            <div className="disk-item-header">
              <span className="disk-mount">{d.mount || d.fs}</span>
              <span className="disk-stats">
                {formatBytes(d.used)} / {formatBytes(d.size)}
                <span style={{ marginLeft: '8px', color: SEVERITY_COLORS[getSeverityColor(d.usagePercent)], fontWeight: 700 }}>
                  {d.usagePercent}%
                </span>
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className={`progress-bar-fill ${getSeverityColor(d.usagePercent)}`}
                style={{ width: `${d.usagePercent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiskChart;

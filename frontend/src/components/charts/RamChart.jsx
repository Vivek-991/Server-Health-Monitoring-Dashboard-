import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import useMetrics from '../../hooks/useMetrics';
import { formatBytes, toFixed } from '../../utils/formatters';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--color-bg-card)', border: '1px solid var(--color-border-strong)',
        borderRadius: 'var(--radius-md)', padding: '8px 14px', boxShadow: 'var(--shadow-card)',
      }}>
        <p style={{ color: '#00d4ff', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
          {toFixed(payload[0].value, 1)}%
        </p>
        {payload[1] && (
          <p style={{ color: '#a855f7', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
            Used: {formatBytes(payload[1]?.payload?.used)}
          </p>
        )}
      </div>
    );
  }
  return null;
};

const RamChart = ({ metrics: propMetrics, history: propHistory, serverId }) => {
  const contextMetrics = useMetrics(serverId);
  const metrics = propMetrics || contextMetrics.current || contextMetrics;
  const rawHistory = propHistory || contextMetrics.history || [];

  const memPercent = metrics?.memory?.usagePercent ?? contextMetrics.memPercent ?? 0;
  const memTotal = metrics?.memory?.total ?? contextMetrics.memTotal ?? 0;
  const memUsed = metrics?.memory?.used ?? contextMetrics.memUsed ?? 0;
  const memFree = metrics?.memory?.free ?? contextMetrics.memFree ?? (memTotal - memUsed);

  const history = rawHistory.length > 0 ? rawHistory : (metrics ? [metrics] : []);

  const data = history.map((snap, i) => ({
    index: i,
    ram: snap.memory?.usagePercent ?? 0,
    used: snap.memory?.used ?? 0,
  }));

  return (
    <div className="chart-card" id="memory">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">💾 RAM Usage</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Total: {formatBytes(memTotal)} · Free: {formatBytes(memFree)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="chart-card-badge" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
            Used {formatBytes(memUsed)}
          </span>
          <span className="chart-card-badge" style={{
            background: memPercent >= 90 ? 'rgba(239,68,68,0.15)' : 'rgba(168,85,247,0.1)',
            color: memPercent >= 90 ? '#ef4444' : '#a855f7',
          }}>
            {toFixed(memPercent)}%
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 200, minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="index" tick={false} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone" dataKey="ram"
              stroke="#00d4ff" strokeWidth={2}
              fill="url(#ramGrad)" dot={false} isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RamChart;

import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import useMetrics from '../../hooks/useMetrics';
import { toFixed } from '../../utils/formatters';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--color-bg-card)', border: '1px solid var(--color-border-strong)',
        borderRadius: 'var(--radius-md)', padding: '8px 14px',
        boxShadow: 'var(--shadow-card)',
      }}>
        <p style={{ color: '#6384ff', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
          {toFixed(payload[0].value, 1)}%
        </p>
      </div>
    );
  }
  return null;
};

const CpuChart = ({ metrics: propMetrics, history: propHistory, serverId }) => {
  const contextMetrics = useMetrics(serverId);
  const metrics = propMetrics || contextMetrics.current || contextMetrics;
  const rawHistory = propHistory || contextMetrics.history || [];

  const cpuUsage = metrics?.cpu?.usage ?? metrics?.cpuUsage ?? 0;
  const cpuModel = metrics?.cpu?.model ?? metrics?.cpuModel ?? 'CPU';
  const cpuCores = metrics?.cpu?.cores ?? metrics?.cpuCores ?? 1;
  const cpuSpeed = metrics?.cpu?.speed ?? metrics?.cpuSpeed ?? 0;

  // Build history array with fallback to current snapshot if history is empty
  const history = rawHistory.length > 0 ? rawHistory : (metrics ? [metrics] : []);

  const data = history.map((snap, i) => ({
    index: i,
    cpu: snap.cpu?.usage ?? 0,
  }));

  const avg = data.length > 0
    ? (data.reduce((s, d) => s + d.cpu, 0) / data.length).toFixed(1)
    : 0;

  return (
    <div className="chart-card" id="cpu">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">🖥️ CPU Usage</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {cpuModel} · {cpuCores} cores {cpuSpeed ? `· ${cpuSpeed} GHz` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="chart-card-badge" style={{ background: 'rgba(99,132,255,0.1)', color: '#6384ff' }}>
            Avg {avg}%
          </span>
          <span className="chart-card-badge" style={{
            background: cpuUsage >= 90 ? 'rgba(239,68,68,0.15)' : 'rgba(99,132,255,0.1)',
            color: cpuUsage >= 90 ? '#ef4444' : '#6384ff',
          }}>
            Now {toFixed(cpuUsage)}%
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 200, minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6384ff" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6384ff" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="index" tick={false} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={80} stroke="rgba(239,68,68,0.3)" strokeDasharray="4 4" />
            <Area
              type="monotone" dataKey="cpu"
              stroke="#6384ff" strokeWidth={2}
              fill="url(#cpuGrad)" dot={false} isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CpuChart;

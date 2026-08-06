import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import useMetrics from '../../hooks/useMetrics';
import { formatBandwidth } from '../../utils/formatters';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--color-bg-card)', border: '1px solid var(--color-border-strong)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px', boxShadow: 'var(--shadow-card)',
      }}>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
            {p.name}: {formatBandwidth(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const NetworkChart = ({ metrics: propMetrics, history: propHistory, serverId }) => {
  const contextMetrics = useMetrics(serverId);
  const metrics = propMetrics || contextMetrics.current || contextMetrics;
  const rawHistory = propHistory || contextMetrics.history || [];

  const network = propMetrics?.network || contextMetrics.network || {};
  const history = rawHistory.length > 0 ? rawHistory : (metrics ? [metrics] : []);

  const data = history.map((snap, i) => ({
    index: i,
    rx: snap.network?.rx_sec ?? 0,
    tx: snap.network?.tx_sec ?? 0,
  }));

  return (
    <div className="chart-card" id="network">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">🌐 Network Traffic</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Interface: {network?.interface || 'eth0'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="chart-card-badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            ↓ {formatBandwidth(network?.rx_sec)}
          </span>
          <span className="chart-card-badge" style={{ background: 'rgba(99,132,255,0.1)', color: '#6384ff' }}>
            ↑ {formatBandwidth(network?.tx_sec)}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 200, minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="index" tick={false} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => formatBandwidth(v)} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
                  {value === 'rx' ? '↓ Download' : '↑ Upload'}
                </span>
              )}
              wrapperStyle={{ paddingTop: '8px' }}
            />
            <Line
              type="monotone" dataKey="rx" name="rx"
              stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false}
            />
            <Line
              type="monotone" dataKey="tx" name="tx"
              stroke="#6384ff" strokeWidth={2} dot={false} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default NetworkChart;

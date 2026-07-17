import React, { useState, useMemo } from 'react';
import PageLayout from '../components/common/PageLayout';
import { useMetricsContext } from '../context/MetricsContext';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

// ── Custom Tooltip for Recharts ────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, unit = '%' }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--color-bg-card)', 
        border: '1px solid var(--color-border-strong)',
        borderRadius: 'var(--radius-md)', 
        padding: '8px 14px',
        boxShadow: 'var(--shadow-card)',
      }}>
        <p style={{ color: payload[0].stroke, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
          {payload[0].value.toFixed(1)}{unit}
        </p>
      </div>
    );
  }
  return null;
};

// ── Stats calculator ───────────────────────────────────────────────────────────
const statsOf = (arr) => {
  if (!arr || arr.length === 0) return { min: 0, max: 0, avg: 0, p95: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  return { min: sorted[0], max: sorted[sorted.length - 1], avg, p95 };
};

const fmt = (v) => v.toFixed(1);

// ── KPI card ──────────────────────────────────────────────────────────────────
const KPI = ({ label, value, unit, icon, color }) => (
  <div className="card kpi-card">
    <div className="kpi-icon" style={{ color }}>{icon}</div>
    <div className="kpi-val" style={{ color }}>{value}<span className="kpi-unit">{unit}</span></div>
    <div className="kpi-label">{label}</div>
  </div>
);

// ── Analytics Page ─────────────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const { history } = useMetricsContext();
  const [range, setRange] = useState(150); // number of history points to use

  const slice = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.slice(-range);
  }, [history, range]);

  // Transform data for Recharts
  const chartData = useMemo(() => {
    return slice.map((snap, i) => {
      const ago = (slice.length - 1 - i) * 2;
      const timeLabel = ago === 0 ? 'now' : `${ago}s`;
      return {
        index: i,
        timeLabel,
        cpu: snap.cpu?.usage ?? 0,
        ram: snap.memory?.usagePercent ?? 0,
        disk: snap.disks?.[0]?.usagePercent ?? 0,
        network: (snap.network?.rx_sec ?? 0) / 1024, // Convert to KB/s
      };
    });
  }, [slice]);

  const cpuData = chartData.map(d => d.cpu);
  const ramData = chartData.map(d => d.ram);
  const diskData = chartData.map(d => d.disk);
  const netData = chartData.map(d => d.network);

  const cpuStats  = statsOf(cpuData);
  const ramStats  = statsOf(ramData);
  const diskStats = statsOf(diskData);
  const netStats  = statsOf(netData);

  const exportCSV = () => {
    const header = 'Time,CPU%,RAM%,Disk%,Network KB/s';
    const rows = chartData.map((d) => [
      d.timeLabel,
      d.cpu.toFixed(2),
      d.ram.toFixed(2),
      d.disk.toFixed(2),
      d.network.toFixed(2),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob);
    a.download = `analytics_${Date.now()}.csv`; 
    a.click();
  };

  const RANGES = [{ label: '5 min', val: 150 }, { label: '15 min', val: 450 }, { label: '30 min', val: 900 }];

  return (
    <PageLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Analytics</h1>
          <p className="page-sub">{slice.length} data points · updates every 2s</p>
        </div>
        <div className="page-header-actions">
          <div className="range-tabs">
            {RANGES.map((r) => (
              <button key={r.val} className={`range-tab ${range === r.val ? 'active' : ''}`} onClick={() => setRange(r.val)}>
                {r.label}
              </button>
            ))}
          </div>
          <button className="btn-secondary" onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPI label="Avg CPU" value={fmt(cpuStats.avg)} unit="%" icon="🖥️" color="#6384ff" />
        <KPI label="Peak RAM" value={fmt(ramStats.max)} unit="%" icon="💾" color="#00d4ff" />
        <KPI label="Avg Disk" value={fmt(diskStats.avg)} unit="%" icon="💿" color="#22c55e" />
        <KPI label="Peak Network" value={fmt(netStats.max)} unit=" KB/s" icon="🌐" color="#f59e0b" />
      </div>

      {/* Charts */}
      <div className="analytics-charts-grid">
        {[
          { title: 'CPU Usage', dataKey: 'cpu', color: '#6384ff', unit: '%', domain: [0, 100], gradId: 'cpuGrad' },
          { title: 'RAM Usage', dataKey: 'ram', color: '#00d4ff', unit: '%', domain: [0, 100], gradId: 'ramGrad' },
          { title: 'Disk Usage', dataKey: 'disk', color: '#22c55e', unit: '%', domain: [0, 100], gradId: 'diskGrad' },
          { title: 'Network RX Speed', dataKey: 'network', color: '#f59e0b', unit: ' KB/s', domain: [0, 'auto'], gradId: 'netGrad' },
        ].map(({ title, dataKey, color, unit, domain, gradId }) => (
          <div className="card analytics-chart-card" key={title}>
            <div className="analytics-chart-title">{title}</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="timeLabel" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={domain} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}${unit}`} />
                  <RechartsTooltip content={<CustomTooltip unit={unit} />} isAnimationActive={false} />
                  <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Stats table */}
      <div className="card">
        <div className="analytics-table-title">Statistics Summary</div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Metric</th><th>Min</th><th>Max</th><th>Average</th><th>95th Percentile</th></tr>
            </thead>
            <tbody>
              {[
                { name: '🖥️ CPU Usage', stats: cpuStats, unit: '%' },
                { name: '💾 RAM Usage', stats: ramStats, unit: '%' },
                { name: '💿 Disk Usage', stats: diskStats, unit: '%' },
                { name: '🌐 Network RX', stats: netStats, unit: ' KB/s' },
              ].map(({ name, stats, unit }) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="td-mono">{fmt(stats.min)}{unit}</td>
                  <td className="td-mono" style={{ color: stats.max > 80 ? '#ef4444' : 'inherit' }}>{fmt(stats.max)}{unit}</td>
                  <td className="td-mono">{fmt(stats.avg)}{unit}</td>
                  <td className="td-mono">{fmt(stats.p95)}{unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
};

export default AnalyticsPage;

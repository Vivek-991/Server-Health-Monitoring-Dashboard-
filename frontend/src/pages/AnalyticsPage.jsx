import React, { useState, useMemo, useEffect } from 'react';
import PageLayout from '../components/common/PageLayout';
import { useMetricsContext } from '../context/MetricsContext';
import { fetchHistoricalMetrics } from '../api/metricsApi';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

// ── Custom Tooltip for Recharts ────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, unit = '%' }) => {
  if (active && payload?.length) {
    const val = payload[0].value;
    const color = payload[0].stroke;
    return (
      <div style={{
        background: 'rgba(17, 17, 17, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--color-border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        boxShadow: 'var(--shadow-hover)',
      }}>
        <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
          Time: {label}
        </div>
        <div style={{ color, fontWeight: 800, fontSize: 'var(--text-base)', fontFamily: 'var(--font-mono)' }}>
          {val.toFixed(1)}{unit}
        </div>
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

const fmt = (v) => (typeof v === 'number' ? v.toFixed(1) : '0.0');

// ── KPI Card Component ────────────────────────────────────────────────────────
const KPI = ({ label, value, unit, icon, color, status, subtext }) => (
  <div className="card kpi-card" style={{ '--kpi-accent': color }}>
    <div className="kpi-card-header">
      <div className="kpi-icon-wrap" style={{ color }}>{icon}</div>
      {status && (
        <span
          className="kpi-status-tag"
          style={{
            background: status.level === 'critical' ? 'rgba(239, 68, 68, 0.15)' :
                        status.level === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            color: status.level === 'critical' ? '#ef4444' :
                   status.level === 'warning' ? '#f59e0b' : '#22c55e',
            border: `1px solid ${status.level === 'critical' ? 'rgba(239, 68, 68, 0.3)' :
                                 status.level === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          }}
        >
          {status.label}
        </span>
      )}
    </div>
    <div className="kpi-val" style={{ color }}>
      {value}<span className="kpi-unit">{unit}</span>
    </div>
    <div className="kpi-label">{label}</div>
    {subtext && <div className="kpi-subtext">{subtext}</div>}
  </div>
);

// ── Analytics Page Component ──────────────────────────────────────────────────
const AnalyticsPage = () => {
  const { agents = {}, history = [], historyMap = {} } = useMetricsContext();
  const [selectedServerId, setSelectedServerId] = useState('');
  const [range, setRange] = useState(150); // number of history points to use
  const [fetchedHistory, setFetchedHistory] = useState([]);

  const agentKeys = Object.keys(agents);
  const activeServerId = selectedServerId;

  useEffect(() => {
    let isMounted = true;
    fetchHistoricalMetrics(range, activeServerId)
      .then((res) => {
        if (isMounted && res?.data) {
          setFetchedHistory(res.data);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [activeServerId, range]);

  const mergedHistory = useMemo(() => {
    const liveHistory = activeServerId ? (historyMap[activeServerId] || []) : history;
    const combined = [...fetchedHistory, ...liveHistory];
    const map = new Map();
    combined.forEach((snap) => {
      const key = snap._id || snap.timestamp || JSON.stringify(snap);
      map.set(key, snap);
    });
    return Array.from(map.values()).slice(-range);
  }, [fetchedHistory, historyMap, activeServerId, history, range]);

  const slice = mergedHistory;

  // Transform data for Recharts
  const chartData = useMemo(() => {
    return slice.map((snap, i) => {
      const ago = (slice.length - 1 - i) * 2;
      const timeLabel = ago === 0 ? 'now' : `${ago}s`;
      const disks = snap.disks || snap.disk || [];
      return {
        index: i,
        timeLabel,
        cpu: snap.cpu?.usage ?? 0,
        ram: snap.memory?.usagePercent ?? 0,
        disk: disks[0]?.usagePercent ?? 0,
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

  const latestPoint = chartData[chartData.length - 1] || { cpu: 0, ram: 0, disk: 0, network: 0 };

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
    a.download = `analytics_${activeServerId || 'primary'}_${Date.now()}.csv`; 
    a.click();
  };

  const handleAiTrendAudit = () => {
    const serverName = activeServerId ? (agents[activeServerId]?.name || activeServerId) : 'Primary Host Node';
    const prompt = `Analyze historical telemetry trends for ${serverName}:
- CPU: Current ${fmt(latestPoint.cpu)}%, Avg ${fmt(cpuStats.avg)}%, Peak ${fmt(cpuStats.max)}%, P95 ${fmt(cpuStats.p95)}%
- RAM: Current ${fmt(latestPoint.ram)}%, Avg ${fmt(ramStats.avg)}%, Peak ${fmt(ramStats.max)}%, P95 ${fmt(ramStats.p95)}%
- Disk: Current ${fmt(latestPoint.disk)}%, Avg ${fmt(diskStats.avg)}%, Peak ${fmt(diskStats.max)}%
- Network RX: Current ${fmt(latestPoint.network)} KB/s, Peak ${fmt(netStats.max)} KB/s
Please provide an SRE assessment: identify potential bottleneck risks, resource headroom, and recommended optimizations.`;

    window.dispatchEvent(new CustomEvent('open-ai-drawer', { detail: { prompt } }));
  };

  const RANGES = [
    { label: '5 min', val: 150 },
    { label: '15 min', val: 450 },
    { label: '30 min', val: 900 }
  ];

  const getStatus = (val, highThresh = 80, warnThresh = 65) => {
    if (val >= highThresh) return { level: 'critical', label: 'CRITICAL' };
    if (val >= warnThresh) return { level: 'warning', label: 'ELEVATED' };
    return { level: 'healthy', label: 'OPTIMAL' };
  };

  return (
    <PageLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Analytics & Telemetry</h1>
          <p className="page-sub">{slice.length} historical samples · 2-second real-time streaming</p>
        </div>
        <div className="analytics-header-controls">
          {agentKeys.length > 0 && (
            <select
              value={activeServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="analytics-server-select"
            >
              <option value="">🖥️ Primary Node (Localhost)</option>
              {agentKeys.map((key) => {
                const ag = agents[key];
                return (
                  <option key={key} value={key}>
                    🖥️ {ag?.name || key} ({ag?.ip || 'remote'})
                  </option>
                );
              })}
            </select>
          )}

          <div className="range-tabs">
            {RANGES.map((r) => (
              <button
                key={r.val}
                className={`range-tab ${range === r.val ? 'active' : ''}`}
                onClick={() => setRange(r.val)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button className="btn-ai-audit" onClick={handleAiTrendAudit} title="Ask AI SRE Copilot to evaluate telemetry trends">
            ⚡ AI Trend Audit
          </button>

          <button className="btn-secondary" onClick={exportCSV}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPI
          label="Avg CPU Usage"
          value={fmt(cpuStats.avg)}
          unit="%"
          icon="🖥️"
          color="#6384ff"
          status={getStatus(cpuStats.avg, 80, 65)}
          subtext={`Min ${fmt(cpuStats.min)}% · Peak ${fmt(cpuStats.max)}%`}
        />
        <KPI
          label="Peak RAM Usage"
          value={fmt(ramStats.max)}
          unit="%"
          icon="💾"
          color="#00d4ff"
          status={getStatus(ramStats.max, 85, 70)}
          subtext={`Avg ${fmt(ramStats.avg)}% · P95 ${fmt(ramStats.p95)}%`}
        />
        <KPI
          label="Avg Disk Usage"
          value={fmt(diskStats.avg)}
          unit="%"
          icon="💿"
          color="#22c55e"
          status={getStatus(diskStats.avg, 85, 75)}
          subtext={`Peak ${fmt(diskStats.max)}% usage`}
        />
        <KPI
          label="Peak Network RX"
          value={fmt(netStats.max)}
          unit=" KB/s"
          icon="🌐"
          color="#f59e0b"
          status={{ level: netStats.max > 2000 ? 'warning' : 'healthy', label: netStats.max > 2000 ? 'HIGH' : 'NORMAL' }}
          subtext={`Avg ${fmt(netStats.avg)} KB/s throughput`}
        />
      </div>

      {/* Charts Grid */}
      <div className="analytics-charts-grid">
        {[
          {
            title: '🖥️ CPU Utilization',
            dataKey: 'cpu',
            color: '#6384ff',
            unit: '%',
            domain: [0, 100],
            gradId: 'cpuGrad',
            currentVal: latestPoint.cpu,
            maxVal: cpuStats.max,
          },
          {
            title: '💾 Memory (RAM) Allocation',
            dataKey: 'ram',
            color: '#00d4ff',
            unit: '%',
            domain: [0, 100],
            gradId: 'ramGrad',
            currentVal: latestPoint.ram,
            maxVal: ramStats.max,
          },
          {
            title: '💿 Disk Storage Usage',
            dataKey: 'disk',
            color: '#22c55e',
            unit: '%',
            domain: [0, 100],
            gradId: 'diskGrad',
            currentVal: latestPoint.disk,
            maxVal: diskStats.max,
          },
          {
            title: '🌐 Network Inbound (RX)',
            dataKey: 'network',
            color: '#f59e0b',
            unit: ' KB/s',
            domain: [0, 'auto'],
            gradId: 'netGrad',
            currentVal: latestPoint.network,
            maxVal: netStats.max,
          },
        ].map(({ title, dataKey, color, unit, domain, gradId, currentVal, maxVal }) => (
          <div className="analytics-chart-card" key={title}>
            <div className="analytics-chart-header">
              <div className="analytics-chart-title">
                {title}
              </div>
              <div className="analytics-chart-badges">
                <span className="analytics-live-tag">LIVE</span>
                <span className="analytics-stat-pill" style={{ color }}>
                  {fmt(currentVal)}{unit}
                </span>
                <span className="analytics-stat-peak">
                  Peak: {fmt(maxVal)}{unit}
                </span>
              </div>
            </div>
            <div className="analytics-chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 14, bottom: 4, left: -10 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  />
                  <YAxis
                    domain={domain}
                    width={42}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickFormatter={(v) => `${v}${unit}`}
                  />
                  <RechartsTooltip content={<CustomTooltip unit={unit} />} isAnimationActive={false} />
                  <Area
                    type="monotone"
                    dataKey={dataKey}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${gradId})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Stats Table */}
      <div className="analytics-table-card">
        <div className="analytics-table-header">
          <div>
            <div className="analytics-table-title">
              📊 Telemetry & Statistical Distribution
            </div>
            <div className="analytics-table-sub">
              Metrics calculated across {slice.length} historical intervals ({slice.length * 2}s sliding window)
            </div>
          </div>
          <button className="btn-ai-audit" onClick={handleAiTrendAudit}>
            ⚡ Audit with AI Copilot
          </button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Telemetry Metric</th>
                <th>Current</th>
                <th>Minimum</th>
                <th>Maximum</th>
                <th>Average</th>
                <th>95th Percentile</th>
                <th>Utilization Meter</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: '🖥️ CPU Utilization', stats: cpuStats, current: latestPoint.cpu, unit: '%', color: '#6384ff', maxPct: 100 },
                { name: '💾 Memory (RAM) Usage', stats: ramStats, current: latestPoint.ram, unit: '%', color: '#00d4ff', maxPct: 100 },
                { name: '💿 Disk Space Usage', stats: diskStats, current: latestPoint.disk, unit: '%', color: '#22c55e', maxPct: 100 },
                { name: '🌐 Network Inbound (RX)', stats: netStats, current: latestPoint.network, unit: ' KB/s', color: '#f59e0b', maxPct: Math.max(netStats.max, 500) },
              ].map(({ name, stats, current, unit, color, maxPct }) => {
                const avgPct = Math.min(100, Math.max(0, (stats.avg / maxPct) * 100));
                return (
                  <tr key={name}>
                    <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      {name}
                    </td>
                    <td className="td-mono" style={{ color, fontWeight: 700 }}>
                      {fmt(current)}{unit}
                    </td>
                    <td className="td-mono">{fmt(stats.min)}{unit}</td>
                    <td className="td-mono" style={{ color: stats.max > 80 ? '#ef4444' : 'inherit', fontWeight: stats.max > 80 ? 700 : 500 }}>
                      {fmt(stats.max)}{unit}
                    </td>
                    <td className="td-mono">{fmt(stats.avg)}{unit}</td>
                    <td className="td-mono">{fmt(stats.p95)}{unit}</td>
                    <td className="metric-bar-cell">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '3px' }}>
                        <span>Avg Load</span>
                        <span style={{ color }}>{fmt(stats.avg)}{unit}</span>
                      </div>
                      <div className="metric-mini-bar-track">
                        <div
                          className="metric-mini-bar-fill"
                          style={{
                            width: `${avgPct}%`,
                            background: avgPct > 80 ? '#ef4444' : avgPct > 65 ? '#f59e0b' : color,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
};

export default AnalyticsPage;

import React from 'react';
import useMetrics from '../../hooks/useMetrics';

const SystemLoadCard = () => {
  const { load, cpuCores } = useMetrics();

  const avgLoad     = load?.avgLoad ?? 0;
  const currentLoad = load?.currentLoad ?? 0;

  // Normalize load average as a percentage relative to core count
  const loadPercent = cpuCores > 0
    ? Math.min((avgLoad / cpuCores) * 100, 100)
    : Math.min(avgLoad * 100, 100);

  const meters = [
    { label: 'Current Load', value: currentLoad, percent: Math.min(currentLoad, 100), color: 'var(--color-accent-blue)' },
    { label: 'Avg Load (1m)',  value: avgLoad,     percent: loadPercent,               color: 'var(--color-accent-cyan)' },
  ];

  return (
    <div
      className="metric-card"
      style={{ '--card-accent': 'linear-gradient(90deg, #f59e0b, #f97316)' }}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">System Load</span>
        <div className="metric-card-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
          📈
        </div>
      </div>

      <div className="load-meters">
        {meters.map(({ label, value, percent, color }) => (
          <div className="load-meter" key={label}>
            <div className="load-meter-header">
              <span className="load-meter-label">{label}</span>
              <span className="load-meter-value" style={{ color }}>
                {typeof value === 'number' ? value.toFixed(2) : '—'}
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min(percent, 100)}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Core count */}
      <div style={{
        marginTop: '12px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        {Array.from({ length: Math.min(cpuCores, 16) }).map((_, i) => (
          <div
            key={i}
            style={{
              width: '20px', height: '20px',
              borderRadius: '4px',
              background: currentLoad >= (i / Math.min(cpuCores, 16)) * 100
                ? 'rgba(99, 132, 255, 0.65)'
                : 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}

        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
          {cpuCores} cores
        </span>
      </div>
    </div>
  );
};

export default SystemLoadCard;

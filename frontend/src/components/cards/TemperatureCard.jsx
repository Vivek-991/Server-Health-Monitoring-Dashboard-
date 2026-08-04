import React from 'react';
import useMetrics from '../../hooks/useMetrics';
import { formatTemp } from '../../utils/formatters';

const getHeatColor = (temp) => {
  if (temp === null || temp === undefined) return 'var(--color-text-secondary)';
  if (temp >= 85) return 'var(--color-critical)';
  if (temp >= 70) return 'var(--color-warning)';
  if (temp >= 55) return 'var(--color-moderate)';
  return 'var(--color-healthy)';
};

const TemperatureCard = ({ temperature: propTemp, status: propStatus }) => {
  const { temperature: contextTemp, status: contextStatus } = useMetrics();
  const status = propStatus || contextStatus || 'online';
  const isOffline = status === 'offline';
  const temperature = isOffline ? null : (propTemp || contextTemp || {});

  const mainTemp  = temperature?.main;
  const coreTemps = temperature?.cores || [];
  const maxTemp   = temperature?.max;
  const heatColor = isOffline ? 'var(--color-text-secondary)' : getHeatColor(mainTemp);

  return (
    <div
      className="metric-card"
      style={{ '--card-accent': `linear-gradient(90deg, ${heatColor}, #f97316)` }}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">CPU Temperature</span>
        <div className="metric-card-icon" style={{ background: 'rgba(239,68,68,0.1)', color: heatColor }}>
          🌡️
        </div>
      </div>

      {isOffline ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 'var(--text-3xl)', marginBottom: '8px' }}>🔴</div>
          <div style={{ color: 'var(--color-critical)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            Server Offline
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginTop: '4px' }}>
            Temperature metrics unavailable
          </div>
        </div>
      ) : mainTemp === null || mainTemp === undefined ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 'var(--text-3xl)', marginBottom: '8px' }}>🌡️</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            Temperature not available on this system
          </div>
        </div>
      ) : (
        <>
          <div className="temp-display">
            {/* Main temp */}
            <div className="temp-main">
              <div className="temp-value" style={{ color: heatColor }}>
                {mainTemp.toFixed(1)}
                <span style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)' }}>°C</span>
              </div>
              <div className="temp-label">CPU Average</div>
              {maxTemp !== null && maxTemp !== undefined && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Max: {formatTemp(maxTemp)}
                </div>
              )}
            </div>

            {/* Core temps grid */}
            {coreTemps.length > 0 && (
              <div className="temp-cores">
                {coreTemps.slice(0, 8).map((t, i) => (
                  <div key={i} className="temp-core">
                    <div className="temp-core-label">Core {i}</div>
                    <div className="temp-core-val" style={{ color: getHeatColor(t) }}>
                      {formatTemp(t)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Temperature progress bar */}
          <div className="progress-bar-wrapper">
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px'
            }}>
              <span>0°C</span><span>50°C</span><span>100°C</span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min((mainTemp / 100) * 100, 100)}%`,
                  background: `linear-gradient(90deg, #22c55e, #f59e0b, ${heatColor})`,
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TemperatureCard;

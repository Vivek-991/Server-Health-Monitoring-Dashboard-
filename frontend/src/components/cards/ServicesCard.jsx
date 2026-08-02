import React from 'react';
import useMetrics from '../../hooks/useMetrics';

const ServicesCard = ({ services: propServices }) => {
  const { services: contextServices } = useMetrics();
  const services = propServices || contextServices || [];

  const running = services.filter((s) => s.running).length;
  const stopped = services.filter((s) => !s.running).length;

  return (
    <div
      className="metric-card"
      style={{ '--card-accent': 'linear-gradient(90deg, #a855f7, #6384ff)' }}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">Running Services</span>
        <div className="metric-card-icon" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
          ⚙️
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <span style={{
          fontSize: 'var(--text-xs)', fontWeight: 700, padding: '3px 10px',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(34,197,94,0.1)', color: 'var(--color-status-online)',
          border: '1px solid rgba(34,197,94,0.2)'
        }}>
          ✓ {running} Running
        </span>
        {stopped > 0 && (
          <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 700, padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(239,68,68,0.1)', color: 'var(--color-status-offline)',
            border: '1px solid rgba(239,68,68,0.2)'
          }}>
            ✗ {stopped} Stopped
          </span>
        )}
      </div>

      <div className="services-list">
        {services.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', padding: '16px' }}>
            No services data available
          </div>
        ) : (
          services.map((svc, i) => (
            <div className="service-item" key={`${svc.name}-${i}`}>
              <span className="service-name">{svc.name}</span>
              <span className={`service-status ${svc.running ? 'running' : 'stopped'}`}>
                {svc.running ? 'Running' : 'Stopped'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ServicesCard;

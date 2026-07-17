import React, { useMemo } from 'react';
import { computeHealthScore } from '../../utils/healthScore';
import { useMetricsContext } from '../../context/MetricsContext';

// ── SVG Ring Gauge ────────────────────────────────────────────────────────────
const RingGauge = ({ score, color, size = 130 }) => {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score, 100) / 100;
  const dash = circ * pct;
  const gap  = circ - dash;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
      aria-label={`Health score: ${score}`}
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-bg-secondary)"
        strokeWidth={10}
      />
      {/* Score arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
        filter="url(#glow)"
      />
      {/* Glow filter */}
      <defs>
        <filter id="hs-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
};

// ── Score Bar ─────────────────────────────────────────────────────────────────
const ScoreBar = ({ label, score, icon }) => {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  return (
    <div className="hs-bar-row">
      <span className="hs-bar-icon">{icon}</span>
      <span className="hs-bar-label">{label}</span>
      <div className="hs-bar-track">
        <div
          className="hs-bar-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="hs-bar-val" style={{ color }}>{score}</span>
    </div>
  );
};

// ── Main Card ─────────────────────────────────────────────────────────────────
const HealthScoreCard = () => {
  const { current } = useMetricsContext();
  const { score, grade, color, breakdown } = useMemo(
    () => computeHealthScore(current),
    [current]
  );

  return (
    <div
      className="metric-card health-score-card"
      style={{ '--card-accent': `linear-gradient(90deg, ${color}, #6384ff)` }}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">Health Score</span>
        <div
          className="metric-card-icon"
          style={{ background: `${color}18`, color }}
        >
          🏥
        </div>
      </div>

      {/* Ring + grade */}
      <div className="hs-ring-row">
        <div className="hs-ring-wrapper">
          <RingGauge score={score} color={color} />
          {/* Centre text */}
          <div className="hs-ring-center">
            <span className="hs-score-num" style={{ color }}>{score}</span>
            <span className="hs-score-label">/ 100</span>
          </div>
        </div>

        <div className="hs-grade-block">
          <span className="hs-grade" style={{ color }}>{grade}</span>
          <span className="hs-grade-label">
            {score >= 90
              ? 'Excellent'
              : score >= 80
              ? 'Good'
              : score >= 70
              ? 'Fair'
              : score >= 60
              ? 'Poor'
              : 'Critical'}
          </span>
        </div>
      </div>

      {/* Factor breakdown bars */}
      <div className="hs-breakdown">
        {breakdown.map((b) => (
          <ScoreBar key={b.label} {...b} />
        ))}
      </div>
    </div>
  );
};

export default HealthScoreCard;

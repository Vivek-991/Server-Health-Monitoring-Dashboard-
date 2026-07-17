/**
 * healthScore.js
 * Computes an overall server health score (0–100) from live metrics.
 *
 * Weights:
 *  CPU usage       25 %
 *  RAM usage       25 %
 *  Disk usage      20 %
 *  Temperature     15 %
 *  Services up     15 %
 */

/**
 * Map a "usage percent" to a 0-100 sub-score.
 * Higher usage = lower score.
 */
const usageToScore = (pct) => Math.max(0, 100 - pct);

/**
 * Map temperature to score (ideal < 50°C, danger > 90°C).
 */
const tempToScore = (celsius) => {
  if (!celsius || celsius <= 0) return 80; // unknown → neutral
  if (celsius <= 50) return 100;
  if (celsius >= 90) return 0;
  return Math.round(((90 - celsius) / 40) * 100);
};

/**
 * Map services running ratio to score.
 */
const servicesToScore = (services = []) => {
  if (!services.length) return 80;
  const running = services.filter((s) => s.running).length;
  return Math.round((running / services.length) * 100);
};

/**
 * Convert numeric score to letter grade.
 */
export const scoreToGrade = (score) => {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

/**
 * Return accent color for a score.
 */
export const scoreToColor = (score) => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
};

/**
 * scoreToGradient — CSS gradient string based on score.
 */
export const scoreToGradient = (score) => {
  if (score >= 80) return 'linear-gradient(135deg, #22c55e, #4ade80)';
  if (score >= 60) return 'linear-gradient(135deg, #f59e0b, #fbbf24)';
  if (score >= 40) return 'linear-gradient(135deg, #f97316, #fb923c)';
  return 'linear-gradient(135deg, #ef4444, #f87171)';
};

/**
 * computeHealthScore
 * @param {object} current - current metrics snapshot from MetricsContext
 * @returns {{ score, grade, color, gradient, breakdown }}
 */
export const computeHealthScore = (current) => {
  if (!current) {
    return { score: 0, grade: 'N/A', color: '#4a5568', gradient: '#4a5568', breakdown: [] };
  }

  if (current.status === 'offline') {
    return {
      score: 0,
      grade: 'OFFLINE',
      color: '#888888',
      gradient: 'linear-gradient(135deg, #888888, #aaaaaa)',
      breakdown: [
        { label: 'CPU',         score: 0,  weight: '25%', icon: '🖥️' },
        { label: 'Memory',      score: 0,  weight: '25%', icon: '💾' },
        { label: 'Disk',        score: 0, weight: '20%', icon: '💿' },
        { label: 'Temperature', score: 0, weight: '15%', icon: '🌡️' },
        { label: 'Services',    score: 0,  weight: '15%', icon: '⚙️' },
      ],
    };
  }

  const cpuScore  = usageToScore(current.cpu?.usage ?? 50);
  const ramScore  = usageToScore(current.memory?.usagePercent ?? 50);
  const diskScore = usageToScore(current.disk?.[0]?.usagePercent ?? 50);
  const tempScore = tempToScore(current.temperature?.main ?? null);
  const svcScore  = servicesToScore(current.services ?? []);

  const score = Math.round(
    cpuScore  * 0.25 +
    ramScore  * 0.25 +
    diskScore * 0.20 +
    tempScore * 0.15 +
    svcScore  * 0.15
  );

  const breakdown = [
    { label: 'CPU',         score: cpuScore,  weight: '25%', icon: '🖥️' },
    { label: 'Memory',      score: ramScore,  weight: '25%', icon: '💾' },
    { label: 'Disk',        score: diskScore, weight: '20%', icon: '💿' },
    { label: 'Temperature', score: tempScore, weight: '15%', icon: '🌡️' },
    { label: 'Services',    score: svcScore,  weight: '15%', icon: '⚙️' },
  ];

  return {
    score,
    grade: scoreToGrade(score),
    color: scoreToColor(score),
    gradient: scoreToGradient(score),
    breakdown,
  };
};

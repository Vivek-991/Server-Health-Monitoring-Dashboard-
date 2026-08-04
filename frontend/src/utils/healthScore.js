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

const usageToScore = (pct) => {
  const val = typeof pct === 'number' && !isNaN(pct) ? pct : (parseFloat(pct) || 0);
  return Math.max(0, Math.min(100, Math.round(100 - val)));
};

const tempToScore = (celsius) => {
  const num = typeof celsius === 'number' && !isNaN(celsius) ? celsius : parseFloat(celsius);
  if (!num || num <= 0) return 100;
  if (num <= 50) return 100;
  if (num >= 90) return 0;
  return Math.round(((90 - num) / 40) * 100);
};

const servicesToScore = (services = []) => {
  if (!Array.isArray(services) || !services.length) return 100;
  const running = services.filter((s) => s && s.running).length;
  return Math.round((running / services.length) * 100);
};

export const scoreToGrade = (score) => {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

export const scoreToColor = (score) => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
};

export const scoreToGradient = (score) => {
  if (score >= 80) return 'linear-gradient(135deg, #22c55e, #4ade80)';
  if (score >= 60) return 'linear-gradient(135deg, #f59e0b, #fbbf24)';
  if (score >= 40) return 'linear-gradient(135deg, #f97316, #fb923c)';
  return 'linear-gradient(135deg, #ef4444, #f87171)';
};

/**
 * computeHealthScore
 * Handles DB snapshots, agent payloads, and live context objects safely.
 * @param {object} current - metrics snapshot
 * @returns {{ score, grade, color, gradient, breakdown }}
 */
export const computeHealthScore = (current) => {
  if (!current) {
    return { score: 100, grade: 'A+', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)', breakdown: [] };
  }

  if (current.status === 'offline') {
    return {
      score: 0,
      grade: 'OFFLINE',
      color: '#888888',
      gradient: 'linear-gradient(135deg, #888888, #aaaaaa)',
      breakdown: [
        { label: 'CPU',         score: 0, valText: 'Offline', weight: '25%', icon: '🖥️' },
        { label: 'Memory',      score: 0, valText: 'Offline', weight: '25%', icon: '💾' },
        { label: 'Disk',        score: 0, valText: 'Offline', weight: '20%', icon: '💿' },
        { label: 'Temperature', score: 0, valText: 'Offline', weight: '15%', icon: '🌡️' },
        { label: 'Services',    score: 0, valText: 'Offline', weight: '15%', icon: '⚙️' },
      ],
    };
  }

  // Support both "disk" (DB snapshot) and "disks" (agent push) field names
  const diskArray = current.disks ?? current.disk ?? [];
  const primaryDisk = Array.isArray(diskArray) ? diskArray[0] : (diskArray || {});

  const cpuVal  = Number(current.cpu?.usage ?? current.cpuUsage ?? 0);
  const ramVal  = Number(current.memory?.usagePercent ?? current.memPercent ?? 0);
  const diskVal = Number(primaryDisk?.usagePercent ?? current.diskPercent ?? 0);
  const tempVal = current.temperature?.main ?? current.temperatures?.[0]?.main ?? null;
  const services = current.services ?? [];

  const cpuScore  = usageToScore(cpuVal);
  const ramScore  = usageToScore(ramVal);
  const diskScore = usageToScore(diskVal);
  const tempScore = tempToScore(tempVal);
  const svcScore  = servicesToScore(services);

  const rawScore = Math.round(
    cpuScore  * 0.25 +
    ramScore  * 0.25 +
    diskScore * 0.20 +
    tempScore * 0.15 +
    svcScore  * 0.15
  );

  const score = isNaN(rawScore) ? 100 : Math.max(0, Math.min(100, rawScore));

  return {
    score,
    grade: scoreToGrade(score),
    color: scoreToColor(score),
    gradient: scoreToGradient(score),
    breakdown: [
      { label: 'CPU',         score: cpuScore,  valText: `${cpuVal.toFixed(1)}% used`, weight: '25%', icon: '🖥️' },
      { label: 'Memory',      score: ramScore,  valText: `${ramVal.toFixed(1)}% used`, weight: '25%', icon: '💾' },
      { label: 'Disk',        score: diskScore, valText: `${diskVal.toFixed(1)}% used`, weight: '20%', icon: '💿' },
      { label: 'Temperature', score: tempScore, valText: tempVal ? `${tempVal}°C` : 'Optimal', weight: '15%', icon: '🌡️' },
      { label: 'Services',    score: svcScore,  valText: Array.isArray(services) && services.length ? `${services.filter(s=>s.running).length}/${services.length} Up` : 'All Running', weight: '15%', icon: '⚙️' },
    ],
  };
};

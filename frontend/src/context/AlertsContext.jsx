import React, {
  createContext, useContext, useReducer, useEffect, useRef, useCallback,
} from 'react';
import { useMetricsContext } from './MetricsContext';
import { useSettings } from './SettingsContext';

const STORAGE_KEY = 'shm-alerts';
const MAX_ALERTS = 50;

const loadAlerts = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
};

// ── Reducer ───────────────────────────────────────────────────────────────────
const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ALERT': {
      const updated = [action.payload, ...state.alerts].slice(0, MAX_ALERTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { ...state, alerts: updated };
    }
    case 'MARK_ALL_READ':
      return { ...state, alerts: state.alerts.map((a) => ({ ...a, read: true })) };
    case 'DISMISS': {
      const updated = state.alerts.filter((a) => a.id !== action.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { ...state, alerts: updated };
    }
    case 'CLEAR_ALL':
      localStorage.removeItem(STORAGE_KEY);
      return { ...state, alerts: [] };
    default: return state;
  }
};

// ── Context ───────────────────────────────────────────────────────────────────
export const AlertsContext = createContext(null);

export const AlertsProvider = ({ children }) => {
  const { current } = useMetricsContext();
  const { settings } = useSettings();
  const [state, dispatch] = useReducer(reducer, { alerts: loadAlerts() });

  // Track which rules are currently active to avoid duplicate spam
  const activeRules = useRef(new Set());

  useEffect(() => {
    if (!current || !settings) return;

    // Define rules dynamically inside the hook/effect using the current settings values!
    const dynamicRules = [
      {
        id: 'cpu-critical',
        check: (m) => m?.cpu?.usage >= settings.cpuCritical,
        severity: 'critical',
        title: 'CPU Critical',
        getMessage: (m) => `CPU usage at ${m.cpu.usage.toFixed(1)}% — exceeds ${settings.cpuCritical}% threshold`,
        icon: '🖥️',
      },
      {
        id: 'cpu-warning',
        check: (m) => m?.cpu?.usage >= settings.cpuWarning && m?.cpu?.usage < settings.cpuCritical,
        severity: 'warning',
        title: 'CPU High',
        getMessage: (m) => `CPU usage at ${m.cpu.usage.toFixed(1)}% — exceeds ${settings.cpuWarning}% threshold`,
        icon: '🖥️',
      },
      {
        id: 'ram-critical',
        check: (m) => m?.memory?.usagePercent >= settings.ramCritical,
        severity: 'critical',
        title: 'Memory Critical',
        getMessage: (m) => `RAM usage at ${m.memory.usagePercent.toFixed(1)}% — exceeds ${settings.ramCritical}% threshold`,
        icon: '💾',
      },
      {
        id: 'ram-warning',
        check: (m) => m?.memory?.usagePercent >= settings.ramWarning && m?.memory?.usagePercent < settings.ramCritical,
        severity: 'warning',
        title: 'Memory High',
        getMessage: (m) => `RAM usage at ${m.memory.usagePercent.toFixed(1)}% — exceeds ${settings.ramWarning}% threshold`,
        icon: '💾',
      },
      {
        id: 'disk-critical',
        check: (m) => (m?.disks?.[0]?.usagePercent ?? 0) >= settings.diskCritical,
        severity: 'critical',
        title: 'Disk Space Critical',
        getMessage: (m) => `Disk usage at ${(m.disks?.[0]?.usagePercent ?? 0).toFixed(1)}% — exceeds ${settings.diskCritical}% threshold`,
        icon: '💿',
      },
      {
        id: 'disk-warning',
        check: (m) => (m?.disks?.[0]?.usagePercent ?? 0) >= settings.diskWarning && (m?.disks?.[0]?.usagePercent ?? 0) < settings.diskCritical,
        severity: 'warning',
        title: 'Disk Space Low',
        getMessage: (m) => `Disk usage at ${(m.disks?.[0]?.usagePercent ?? 0).toFixed(1)}% — exceeds ${settings.diskWarning}% threshold`,
        icon: '💿',
      },
      {
        id: 'temp-critical',
        check: (m) => {
          const mainTemp = m?.temperatures?.[0]?.main ?? 0;
          return mainTemp >= settings.tempCritical;
        },
        severity: 'critical',
        title: 'Temperature Critical',
        getMessage: (m) => `CPU temp at ${m.temperatures?.[0]?.main ?? 0}°C — exceeds ${settings.tempCritical}°C threshold`,
        icon: '🌡️',
      },
      {
        id: 'temp-warning',
        check: (m) => {
          const mainTemp = m?.temperatures?.[0]?.main ?? 0;
          return mainTemp >= settings.tempWarning && mainTemp < settings.tempCritical;
        },
        severity: 'warning',
        title: 'Temperature High',
        getMessage: (m) => `CPU temp at ${m.temperatures?.[0]?.main ?? 0}°C — exceeds ${settings.tempWarning}°C threshold`,
        icon: '🌡️',
      },
    ];

    dynamicRules.forEach((rule) => {
      const triggered = rule.check(current);
      const wasActive = activeRules.current.has(rule.id);

      if (triggered && !wasActive) {
        // Newly triggered
        activeRules.current.add(rule.id);
        dispatch({
          type: 'ADD_ALERT',
          payload: {
            id: `${rule.id}-${Date.now()}`,
            ruleId: rule.id,
            severity: rule.severity,
            title: rule.title,
            message: rule.getMessage(current),
            icon: rule.icon,
            timestamp: new Date().toISOString(),
            read: false,
          },
        });
      } else if (!triggered && wasActive) {
        // Resolved
        activeRules.current.delete(rule.id);
      }
    });
  }, [current, settings]);

  const markAllRead = useCallback(() => dispatch({ type: 'MARK_ALL_READ' }), []);
  const dismiss = useCallback((id) => dispatch({ type: 'DISMISS', id }), []);
  const clearAll = useCallback(() => dispatch({ type: 'CLEAR_ALL' }), []);

  const unreadCount = state.alerts.filter((a) => !a.read).length;

  return (
    <AlertsContext.Provider value={{
      alerts: state.alerts,
      unreadCount,
      markAllRead,
      dismiss,
      clearAll,
    }}>
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider');
  return ctx;
};

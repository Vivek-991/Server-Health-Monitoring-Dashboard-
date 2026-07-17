import React, {
  createContext, useContext, useReducer, useCallback,
} from 'react';

const STORAGE_KEY = 'shm-activity';
const MAX_LOGS = 100;

const loadLogs = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
};

const ICONS = {
  auth:   '🔐',
  alert:  '🚨',
  metric: '📊',
  system: '⚙️',
  user:   '👤',
  info:   'ℹ️',
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD_LOG': {
      const updated = [action.payload, ...state.logs].slice(0, MAX_LOGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { ...state, logs: updated };
    }
    case 'CLEAR':
      localStorage.removeItem(STORAGE_KEY);
      return { ...state, logs: [] };
    default: return state;
  }
};

export const ActivityContext = createContext(null);

export const ActivityProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, { logs: loadLogs() });

  const addLog = useCallback((type, action, detail = '') => {
    dispatch({
      type: 'ADD_LOG',
      payload: {
        id: Date.now().toString(),
        type,
        icon: ICONS[type] || ICONS.info,
        action,
        detail,
        timestamp: new Date().toISOString(),
      },
    });
  }, []);

  const clearLogs = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  return (
    <ActivityContext.Provider value={{ logs: state.logs, addLog, clearLogs }}>
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivity = () => {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity must be used within ActivityProvider');
  return ctx;
};

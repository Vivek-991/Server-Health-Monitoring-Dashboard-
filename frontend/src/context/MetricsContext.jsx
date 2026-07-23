import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useCallback,
} from 'react';
import { io } from 'socket.io-client';
import { fetchLiveMetrics, fetchAgentServers } from '../api/metricsApi';

const getSocketUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;
  if (typeof window !== 'undefined') {
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]'
    );
    if (isLocalhost) return 'http://localhost:5000';
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

const SOCKET_URL = getSocketUrl();
const MAX_HISTORY = 60; // keep last 60 data points for charts

// ── Initial State ─────────────────────────────────────────────────────────────
const initialState = {
  current: null,         // latest MetricSnapshot for localhost
  history: [],           // array of MetricSnapshots (for charts)
  agents: {},            // remote server metrics mapped by serverId
  connected: false,      // Socket.IO connection status
  loading: true,
  error: null,
};

// ── Reducer ───────────────────────────────────────────────────────────────────
const metricsReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };

    case 'SET_METRICS': {
      const newHistory = [
        ...state.history,
        { ...action.payload, timestamp: new Date() },
      ].slice(-MAX_HISTORY);
      return {
        ...state,
        current: action.payload,
        history: newHistory,
        loading: false,
        error: null,
      };
    }

    case 'SET_INITIAL_METRICS':
      return {
        ...state,
        current: action.payload,
        history: [{ ...action.payload, timestamp: new Date() }],
        loading: false,
        error: null,
      };

    case 'SET_AGENTS':
      return {
        ...state,
        agents: action.payload,
        loading: false,
        error: null,
      };

    default:
      return state;
  }
};

// ── Context ───────────────────────────────────────────────────────────────────
export const MetricsContext = createContext(null);

export const MetricsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(metricsReducer, initialState);
  const socketRef = useRef(null);

  // REST fallback — get first snapshot immediately
  const loadInitialMetrics = useCallback(async () => {
    try {
      const [liveRes, agentsRes] = await Promise.all([
        fetchLiveMetrics(),
        fetchAgentServers().catch(() => ({ success: false, agents: {} }))
      ]);
      
      dispatch({ type: 'SET_INITIAL_METRICS', payload: liveRes.data });
      
      if (agentsRes.success && agentsRes.agents) {
        dispatch({ type: 'SET_AGENTS', payload: agentsRes.agents });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }, []);

  useEffect(() => {
    // Load initial data via REST
    loadInitialMetrics();

    // Connect Socket.IO
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: true });
    });

    socket.on('disconnect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });

    socket.on('connect_error', (err) => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
      dispatch({ type: 'SET_ERROR', payload: `Socket error: ${err.message}` });
    });

    socket.on('metrics:update', (data) => {
      dispatch({ type: 'SET_METRICS', payload: data });
    });

    socket.on('metrics:update:agents', (data) => {
      dispatch({ type: 'SET_AGENTS', payload: data });
    });

    socket.on('metrics:error', (err) => {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    });

    return () => {
      socket.disconnect();
    };
  }, [loadInitialMetrics]);

  return (
    <MetricsContext.Provider value={{ ...state, dispatch }}>
      {children}
    </MetricsContext.Provider>
  );
};

export const useMetricsContext = () => {
  const ctx = useContext(MetricsContext);
  if (!ctx) throw new Error('useMetricsContext must be used within MetricsProvider');
  return ctx;
};

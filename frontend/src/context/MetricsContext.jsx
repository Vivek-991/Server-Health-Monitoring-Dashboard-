import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { fetchLiveMetrics, fetchAgentServers, fetchHistoricalMetrics } from '../api/metricsApi';
import { useAuth } from './AuthContext';

const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.REACT_APP_SOCKET_URL || 'http://127.0.0.1:5000';
};

const SOCKET_URL = getSocketUrl();
const MAX_HISTORY = 60;
const AGENT_OFFLINE_MS = 15000;

const getToken = () => localStorage.getItem('shd-token');

const normalizeAgent = (agent) => {
  const timestamp = agent?.lastSeen || agent?.timestamp;
  const ageMs = timestamp ? Date.now() - new Date(timestamp).getTime() : Number.POSITIVE_INFINITY;
  const status = ageMs > AGENT_OFFLINE_MS ? 'offline' : (agent?.status || 'online');
  return { ...agent, status, lastSeen: agent?.lastSeen || agent?.timestamp || new Date().toISOString() };
};

const normalizeAgentMap = (agents = {}) =>
  Object.fromEntries(
    Object.entries(agents).map(([serverId, agent]) => [serverId, normalizeAgent(agent)])
  );

const initialState = {
  current: null,
  history: [],
  historyMap: {},
  agents: {},
  connected: false,
  loading: true,
  error: null,
};

const metricsReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };
    case 'SET_METRICS': {
      const newHistory = [...state.history, { ...action.payload, timestamp: new Date() }].slice(-MAX_HISTORY);
      return { ...state, current: action.payload, history: newHistory, loading: false, error: null };
    }
    case 'SET_INITIAL_METRICS':
      return { ...state, current: action.payload, history: [{ ...action.payload, timestamp: new Date() }], loading: false, error: null };
    case 'SET_HISTORICAL_METRICS': {
      const snapshots = action.payload?.snapshots || [];
      const newHistoryMap = { ...state.historyMap };

      snapshots.forEach((snap) => {
        const sId = snap.serverId || snap.server || snap.id;
        if (sId) {
          if (!newHistoryMap[sId]) newHistoryMap[sId] = [];
          newHistoryMap[sId].push(snap);
        }
      });

      Object.keys(newHistoryMap).forEach((sId) => {
        newHistoryMap[sId] = newHistoryMap[sId].slice(-MAX_HISTORY);
      });

      return {
        ...state,
        historyMap: newHistoryMap,
      };
    }
    case 'SET_AGENTS': {
      const normalizedAgents = normalizeAgentMap(action.payload);
      const newHistoryMap = { ...state.historyMap };

      Object.entries(normalizedAgents).forEach(([serverId, agent]) => {
        if (agent && agent.status !== 'offline') {
          const existing = newHistoryMap[serverId] || [];
          const last = existing[existing.length - 1];
          const snapshotTime = agent.timestamp || agent.lastSeen || new Date().toISOString();
          if (!last || last.timestamp !== snapshotTime) {
            newHistoryMap[serverId] = [...existing, { ...agent, timestamp: snapshotTime }].slice(-MAX_HISTORY);
          }
        }
      });

      const agentKeys = Object.keys(normalizedAgents);
      const firstKey = agentKeys[0];

      return {
        ...state,
        agents: normalizedAgents,
        historyMap: newHistoryMap,
        current: firstKey ? normalizedAgents[firstKey] : state.current,
        history: firstKey ? (newHistoryMap[firstKey] || []) : state.history,
        loading: false,
      };
    }
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

export const MetricsContext = createContext(null);

export const MetricsProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [state, dispatch] = useReducer(metricsReducer, initialState);
  const socketRef = useRef(null);

  const loadInitialMetrics = useCallback(async () => {
    try {
      const [liveRes, agentsRes, historyRes] = await Promise.all([
        fetchLiveMetrics().catch(() => ({ data: null })),
        fetchAgentServers().catch(() => ({ success: false, agents: {} })),
        fetchHistoricalMetrics(60).catch(() => ({ success: false, data: [] }))
      ]);
      if (liveRes?.data) dispatch({ type: 'SET_INITIAL_METRICS', payload: liveRes.data });
      if (historyRes?.data?.length) dispatch({ type: 'SET_HISTORICAL_METRICS', payload: { snapshots: historyRes.data } });
      if (agentsRes?.success && agentsRes?.agents) {
        dispatch({ type: 'SET_AGENTS', payload: agentsRes.agents });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }, []);

  const connectSocket = useCallback(() => {
    const token = getToken();
    if (!token) return null;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
    });

    socket.on('disconnect', (reason) => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
      if (reason === 'io server disconnect') {
        setTimeout(() => socket.connect(), 2000);
      }
    });

    socket.on('connect_error', (err) => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
      dispatch({ type: 'SET_ERROR', payload: `Socket error: ${err.message}` });
    });

    socket.on('metrics:update', (data) => dispatch({ type: 'SET_METRICS', payload: data }));
    socket.on('metrics:update:agents', (data) => dispatch({ type: 'SET_AGENTS', payload: data }));
    socket.on('metrics:error', (err) => dispatch({ type: 'SET_ERROR', payload: err.message }));

    return socket;
  }, []);

  // Socket and Metrics only run when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      dispatch({ type: 'RESET' });
      return;
    }

    loadInitialMetrics();
    const socket = connectSocket();

    return () => {
      if (socket) socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, loadInitialMetrics, connectSocket]);

  // Re-fetch agent servers when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        fetchAgentServers()
          .then((res) => {
            if (res.success && res.agents) {
              dispatch({ type: 'SET_AGENTS', payload: res.agents });
            }
          })
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated]);

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

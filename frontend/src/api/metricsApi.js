import axios from 'axios';

const TOKEN_KEY = 'shd-token';
const USER_KEY = 'shm-user';

const getToken = () => localStorage.getItem(TOKEN_KEY);
const getUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };

const getApiBaseUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (typeof window !== 'undefined') {
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]'
    );
    if (isLocalhost) return 'http://localhost:5000/api';
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5000/api';
};

const BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const user = getUser();
  if (user?.id) config.headers['x-user-id'] = user.id;
  if (user?.email) config.headers['x-user-email'] = user.email;
  if (user?.name) config.headers['x-user-name'] = user.name;

  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    const message = error.response?.data?.message || error.message || 'Network error';
    return Promise.reject(new Error(message));
  }
);

export const fetchLiveMetrics = () => apiClient.get('/metrics/live');
export const fetchHistoricalMetrics = (limit = 60, serverId = '') => {
  const query = new URLSearchParams({ limit });
  if (serverId) query.append('serverId', serverId);
  return apiClient.get(`/metrics/history?${query.toString()}`);
};
export const fetchServerStatus = () => apiClient.get('/metrics/status');
export const fetchSmtpSettings = () => apiClient.get('/smtp');
export const updateSmtpSettings = (config) => apiClient.post('/smtp', config);
export const testSmtpSettings = () => apiClient.post('/smtp/test');
export const fetchAgentServers = () => apiClient.get('/metrics/agents');
export const deleteAgentServer = (serverId) => apiClient.delete(`/metrics/agents/${serverId}`);
export const deleteAllAgentServers = () => apiClient.delete('/metrics/agents');

export const authApi = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  getMe: () => apiClient.get('/auth/me'),
};

export const serverApi = {
  list: (params) => apiClient.get('/servers', { params }),
  get: (id) => apiClient.get(`/servers/${id}`),
  create: (data) => apiClient.post('/servers', data),
  update: (id, data) => apiClient.put(`/servers/${id}`, data),
  delete: (id) => apiClient.delete(`/servers/${id}`),
  regenerateKey: (id) => apiClient.post(`/servers/${id}/regenerate-key`),
  getMetrics: (id, limit) => apiClient.get(`/servers/${id}/metrics`, { params: { limit } }),
};

export const userApi = {
  list: () => apiClient.get('/users'),
  create: (data) => apiClient.post('/users', data),
  update: (id, data) => apiClient.patch(`/users/${id}`, data),
  delete: (id) => apiClient.delete(`/users/${id}`),
};

export default apiClient;

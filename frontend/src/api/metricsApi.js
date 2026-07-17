import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message || error.message || 'Network error';
    return Promise.reject(new Error(message));
  }
);

/**
 * Fetch the current live metrics snapshot (REST fallback)
 */
export const fetchLiveMetrics = () => apiClient.get('/metrics/live');

/**
 * Fetch historical metric snapshots
 * @param {number} limit - number of snapshots to retrieve (default 60)
 */
export const fetchHistoricalMetrics = (limit = 60) =>
  apiClient.get(`/metrics/history?limit=${limit}`);

/**
 * Fetch quick server status
 */
export const fetchServerStatus = () => apiClient.get('/metrics/status');

/**
 * Fetch and update SMTP settings configurations
 */
export const fetchSmtpSettings = () => apiClient.get('/smtp');
export const updateSmtpSettings = (config) => apiClient.post('/smtp', config);

/**
 * Fetch all active remote server agents
 */
export const fetchAgentServers = () => apiClient.get('/metrics/agents');

export default apiClient;



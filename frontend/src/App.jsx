import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MetricsProvider } from './context/MetricsContext';
import { ThemeProvider }   from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertsProvider }  from './context/AlertsContext';
import { ActivityProvider } from './context/ActivityContext';
import { SettingsProvider } from './context/SettingsContext';

// Pages
import Dashboard  from './pages/Dashboard';
import LoginPage  from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import ServersPage from './pages/ServersPage';
import ServerDetailPage from './pages/ServerDetailPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

// Styles
import './styles/index.css';
import './styles/components.css';
import './styles/pages.css';

// ── Protected Route ───────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// ── Inner app (needs Contexts mounted) ────────────────────────────────────────
const AppRoutes = () => (
  <SettingsProvider>
    <MetricsProvider>
      <AlertsProvider>
        <ActivityProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />
              <Route path="/servers" element={<ProtectedRoute><ServersPage /></ProtectedRoute>} />
              <Route path="/servers/:id" element={<ProtectedRoute><ServerDetailPage /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            </Routes>
          </Router>
        </ActivityProvider>
      </AlertsProvider>
    </MetricsProvider>
  </SettingsProvider>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

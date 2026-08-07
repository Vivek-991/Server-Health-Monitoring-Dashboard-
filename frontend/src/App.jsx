import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MetricsProvider } from './context/MetricsContext';
import { ThemeProvider }   from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertsProvider }  from './context/AlertsContext';
import { ActivityProvider } from './context/ActivityContext';
import { SettingsProvider } from './context/SettingsContext';
import Loader from './components/common/Loader';
import './styles/index.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/dashboard.css';
import './styles/themeToggle.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const ServersPage = lazy(() => import('./pages/ServersPage'));
const ServerDetailPage = lazy(() => import('./pages/ServerDetailPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Loader message="Authenticating…" />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => (
  <SettingsProvider>
    <MetricsProvider>
      <AlertsProvider>
        <ActivityProvider>
          <Router>
            <Suspense fallback={<Loader message="Loading page…" />}>
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
            </Suspense>
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

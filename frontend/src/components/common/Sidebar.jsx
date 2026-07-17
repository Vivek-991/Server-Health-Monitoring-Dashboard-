import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useMetrics from '../../hooks/useMetrics';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { useAlerts } from '../../context/AlertsContext';

const mainNavItems = [
  { icon: '📊', label: 'Dashboard',     path: '/' },
  { icon: '🖥️', label: 'Servers',       path: '/servers' },
  { icon: '📈', label: 'Analytics',     path: '/analytics' },
  { icon: '📄', label: 'Reports',       path: '/reports' },
  { icon: '👥', label: 'Users',         path: '/users' },
  { icon: '⚙️', label: 'Settings',      path: '/settings' },
];

const metricNavItems = [
  { icon: '🖥️', label: 'CPU',           hash: '#cpu' },
  { icon: '💾', label: 'Memory',        hash: '#memory' },
  { icon: '💿', label: 'Disk',          hash: '#disk' },
  { icon: '🌐', label: 'Network',       hash: '#network' },
  { icon: '⚙️', label: 'Services',      hash: '#services' },
  { icon: '🌡️', label: 'Temperature',   hash: '#temperature' },
];

const Sidebar = () => {
  const { connected, cpuModel } = useMetrics();
  const { user, logout } = useAuth();
  const { addLog } = useActivity();
  const { unreadCount } = useAlerts();
  const location = useLocation();

  const handleLogout = () => {
    addLog('auth', 'User logged out', user?.email || '');
    logout();
  };

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">⚡</div>
        <div className="sidebar-logo-text">
          ServerPulse
          <span>Health Monitor</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {mainNavItems.map((item) => (
          <Link 
            key={item.label} 
            to={item.path} 
            className={`sidebar-nav-item ${isActive(item.path) ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.label === 'Alerts' && unreadCount > 0 && (
              <span className="sidebar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </Link>
        ))}

        <div className="sidebar-section-label">Metrics Highlights</div>
        {metricNavItems.map((item) => {
          // If we are on dashboard, scroll to hash. Otherwise, go to dashboard root + hash.
          const destination = location.pathname === '/' ? item.hash : `/${item.hash}`;
          return (
            <a 
              key={item.label} 
              href={destination} 
              className="sidebar-nav-item"
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Footer — user info + logout */}
      <div className="sidebar-footer">
        <div className="server-info">
          <div className={`server-info-dot ${connected ? 'online' : 'offline'}`} />
          <div className="server-info-text">
            <strong>{connected ? 'Connected' : 'Offline'}</strong>
            {cpuModel || 'Local Server'}
          </div>
        </div>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{user.avatar || user.name?.charAt(0)?.toUpperCase()}</div>
            <div className="sidebar-user-info">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
            >
              🚪
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

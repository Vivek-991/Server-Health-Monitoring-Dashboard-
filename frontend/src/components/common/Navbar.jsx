import React, { useState, useEffect } from 'react';
import useMetrics from '../../hooks/useMetrics';
import { useTheme } from '../../context/ThemeContext';
import { useAlerts } from '../../context/AlertsContext';
import NotificationPanel from './NotificationPanel';

const Navbar = () => {
  const { connected, status } = useMetrics();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useAlerts();
  const [time, setTime] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const [bellShake, setBellShake] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Shake bell when new alerts arrive
  useEffect(() => {
    if (unreadCount > 0) {
      setBellShake(true);
      const t = setTimeout(() => setBellShake(false), 600);
      return () => clearTimeout(t);
    }
  }, [unreadCount]);

  const formatTime = (d) =>
    d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDate = (d) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const isDark = theme === 'dark';

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <span className="navbar-title">Server Health Monitor</span>
        </div>
        <div className="navbar-right">
          <span className="navbar-time">{formatDate(time)} &nbsp;|&nbsp; {formatTime(time)}</span>

          {/* ── Theme Toggle ──────────────────────────────────────── */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            <span className="theme-toggle-track">
              <span className={`theme-toggle-thumb ${isDark ? 'dark' : 'light'}`} />
            </span>
            <span className="theme-toggle-icon">{isDark ? '🌙' : '☀️'}</span>
          </button>

          {/* ── Notification Bell ─────────────────────────────────── */}
          <button
            id="notif-bell-btn"
            className={`notif-bell-btn ${bellShake ? 'shake' : ''}`}
            onClick={() => setNotifOpen((v) => !v)}
            title="Notifications"
            aria-label="Toggle notifications"
            aria-expanded={notifOpen}
          >
            🔔
            {unreadCount > 0 && (
              <span className="notif-bell-badge" aria-label={`${unreadCount} unread`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* ── Status badge ──────────────────────────────────────── */}
          <div
            className="status-badge"
            style={{ marginLeft: '4px' }}
            data-status={connected ? (status || 'online') : 'offline'}
          >
            <span className={`status-badge ${connected ? 'online' : 'offline'}`}>
              <span className="status-badge-dot" />
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
      </nav>

      <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
};

export default Navbar;

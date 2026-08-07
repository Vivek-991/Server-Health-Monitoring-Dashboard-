import React, { useState, useEffect } from 'react';
import { useAlerts } from '../../context/AlertsContext';
import NotificationPanel from './NotificationPanel';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
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

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <span className="navbar-title">Server Health Monitor</span>
        </div>
        <div className="navbar-right">
          <span className="navbar-time">{formatDate(time)} &nbsp;|&nbsp; {formatTime(time)}</span>

          {/* ── Theme Toggle ──────────────────────────────────────── */}
          <ThemeToggle />

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
        </div>
      </nav>

      <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
};

export default Navbar;

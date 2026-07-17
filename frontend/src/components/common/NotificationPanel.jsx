import React, { useEffect, useRef } from 'react';
import { useAlerts } from '../../context/AlertsContext';

// ── Relative time helper ──────────────────────────────────────────────────────
const relTime = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

// ── Single Alert Row ──────────────────────────────────────────────────────────
const AlertRow = ({ alert, onDismiss }) => (
  <div className={`notif-item notif-item--${alert.severity} ${alert.read ? 'read' : 'unread'}`}>
    <div className="notif-item-icon">{alert.icon}</div>
    <div className="notif-item-body">
      <div className="notif-item-title">{alert.title}</div>
      <div className="notif-item-msg">{alert.message}</div>
      <div className="notif-item-time">{relTime(alert.timestamp)}</div>
    </div>
    <button
      className="notif-item-dismiss"
      onClick={() => onDismiss(alert.id)}
      title="Dismiss"
      aria-label="Dismiss alert"
    >
      ×
    </button>
  </div>
);

// ── Panel ─────────────────────────────────────────────────────────────────────
const NotificationPanel = ({ isOpen, onClose }) => {
  const { alerts, unreadCount, markAllRead, dismiss, clearAll } = useAlerts();
  const panelRef = useRef(null);

  // Mark all read when panel opens
  useEffect(() => {
    if (isOpen) markAllRead();
  }, [isOpen, markAllRead]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="notif-backdrop" onClick={onClose} />}

      <div ref={panelRef} className={`notif-panel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="notif-header">
          <div className="notif-header-left">
            <span className="notif-header-title">🔔 Notifications</span>
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount}</span>
            )}
          </div>
          <div className="notif-header-actions">
            {alerts.length > 0 && (
              <button className="notif-action-btn" onClick={clearAll}>
                Clear all
              </button>
            )}
            <button
              className="notif-close-btn"
              onClick={onClose}
              aria-label="Close notifications"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="notif-body">
          {alerts.length === 0 ? (
            <div className="notif-empty">
              <div className="notif-empty-icon">✅</div>
              <p className="notif-empty-title">All clear!</p>
              <p className="notif-empty-sub">No alerts at the moment.</p>
            </div>
          ) : (
            <div className="notif-list">
              {alerts.map((a) => (
                <AlertRow key={a.id} alert={a} onDismiss={dismiss} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationPanel;

import React, { useState, useEffect } from 'react';
import PageLayout from '../components/common/PageLayout';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useActivity } from '../context/ActivityContext';
import { fetchSmtpSettings, updateSmtpSettings } from '../api/metricsApi';

const SettingsPage = () => {
  const { settings, updateSetting, resetToDefaults } = useSettings();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addLog } = useActivity();
  const [activeTab, setActiveTab] = useState('thresholds');

  // Account form local states
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [accSuccess, setAccSuccess] = useState('');
  const [accError, setAccError] = useState('');

  // SMTP Setup form states
  const [smtpForm, setSmtpForm] = useState({ host: '', port: 587, user: '', pass: '', from: '', to: '' });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSuccess, setSmtpSuccess] = useState('');
  const [smtpError, setSmtpError] = useState('');

  // Fetch SMTP config when switching to smtp tab
  useEffect(() => {
    if (activeTab === 'smtp') {
      const loadSmtp = async () => {
        setSmtpLoading(true);
        setSmtpError('');
        try {
          const res = await fetchSmtpSettings();
          if (res.success && res.config) {
            setSmtpForm(res.config);
          }
        } catch (err) {
          setSmtpError('Failed to load SMTP settings: ' + err.message);
        } finally {
          setSmtpLoading(false);
        }
      };
      loadSmtp();
    }
  }, [activeTab]);

  const handleSaveAccount = (e) => {
    e.preventDefault();
    setAccSuccess('');
    setAccError('');

    if (!name.trim()) {
      setAccError('Name cannot be empty.');
      return;
    }

    try {
      const users = JSON.parse(localStorage.getItem('shm-users')) || [];
      const userIndex = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
      
      if (userIndex !== -1) {
        if (newPassword) {
          if (users[userIndex].password !== currentPassword) {
            setAccError('Current password does not match.');
            return;
          }
          if (newPassword.length < 6) {
            setAccError('New password must be at least 6 characters.');
            return;
          }
          users[userIndex].password = newPassword;
        }

        users[userIndex].name = name;
        users[userIndex].avatar = name.charAt(0).toUpperCase();
        localStorage.setItem('shm-users', JSON.stringify(users));
        
        const { password, ...safeUser } = users[userIndex];
        localStorage.setItem('shm-user', JSON.stringify(safeUser));
        
        addLog('user', 'Account details updated', user.email);
        setAccSuccess('Account details saved successfully! Refresh/re-login to sync all avatars.');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setAccError('User record not found.');
      }
    } catch (err) {
      setAccError('Error updating account.');
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setSmtpSuccess('');
    setSmtpError('');
    setSmtpLoading(true);

    try {
      const res = await updateSmtpSettings(smtpForm);
      if (res.success) {
        setSmtpSuccess('SMTP alert settings saved successfully! Node transporter reinitialized.');
        addLog('system', 'SMTP credentials updated', user?.email);
      } else {
        setSmtpError(res.message || 'Failed to update SMTP configurations.');
      }
    } catch (err) {
      setSmtpError(err.message || 'SMTP update request failed.');
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all threshold settings to factory defaults?')) {
      resetToDefaults();
      addLog('system', 'System settings reset to defaults', user?.email);
    }
  };

  return (
    <PageLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Settings</h1>
          <p className="page-sub">Configure thresholds, notification triggers and dashboard preferences</p>
        </div>
      </div>

      <div className="settings-container">
        <div className="card settings-tabs-card">
          <div className="settings-sidebar">
            <button className={`settings-tab-link ${activeTab === 'thresholds' ? 'active' : ''}`} onClick={() => setActiveTab('thresholds')}>🚨 Thresholds</button>
            <button className={`settings-tab-link ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}>🎨 Preferences</button>
            <button className={`settings-tab-link ${activeTab === 'smtp' ? 'active' : ''}`} onClick={() => setActiveTab('smtp')}>📧 Email Alerts</button>
            <button className={`settings-tab-link ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>👤 Account</button>
          </div>
        </div>

        <div className="card settings-content-card">
          {activeTab === 'thresholds' && (
            <div className="settings-panel animate-fade-in">
              <div className="settings-panel-header">
                <h3>System Metric Thresholds</h3>
                <p>Define triggers for CPU, memory, temperature and disk warnings/alerts.</p>
              </div>

              <div className="thresholds-list">
                {/* CPU */}
                <div className="threshold-row">
                  <div className="threshold-info">
                    <strong>🖥️ CPU Warning</strong>
                    <span>Current: {settings.cpuWarning}%</span>
                  </div>
                  <input type="range" min="50" max="95" value={settings.cpuWarning} onChange={(e) => updateSetting('cpuWarning', parseInt(e.target.value))} />
                </div>
                <div className="threshold-row">
                  <div className="threshold-info">
                    <strong>🖥️ CPU Critical</strong>
                    <span>Current: {settings.cpuCritical}%</span>
                  </div>
                  <input type="range" min="60" max="99" value={settings.cpuCritical} onChange={(e) => updateSetting('cpuCritical', parseInt(e.target.value))} />
                </div>

                {/* RAM */}
                <div className="threshold-row">
                  <div className="threshold-info">
                    <strong>💾 RAM Warning</strong>
                    <span>Current: {settings.ramWarning}%</span>
                  </div>
                  <input type="range" min="50" max="95" value={settings.ramWarning} onChange={(e) => updateSetting('ramWarning', parseInt(e.target.value))} />
                </div>
                <div className="threshold-row">
                  <div className="threshold-info">
                    <strong>💾 RAM Critical</strong>
                    <span>Current: {settings.ramCritical}%</span>
                  </div>
                  <input type="range" min="60" max="99" value={settings.ramCritical} onChange={(e) => updateSetting('ramCritical', parseInt(e.target.value))} />
                </div>

                {/* Disk */}
                <div className="threshold-row">
                  <div className="threshold-info">
                    <strong>💿 Disk Warning</strong>
                    <span>Current: {settings.diskWarning}%</span>
                  </div>
                  <input type="range" min="40" max="90" value={settings.diskWarning} onChange={(e) => updateSetting('diskWarning', parseInt(e.target.value))} />
                </div>
                <div className="threshold-row">
                  <div className="threshold-info">
                    <strong>💿 Disk Critical</strong>
                    <span>Current: {settings.diskCritical}%</span>
                  </div>
                  <input type="range" min="50" max="99" value={settings.diskCritical} onChange={(e) => updateSetting('diskCritical', parseInt(e.target.value))} />
                </div>

                {/* Temp */}
                <div className="threshold-row">
                  <div className="threshold-info">
                    <strong>🌡️ Temp Warning</strong>
                    <span>Current: {settings.tempWarning}°C</span>
                  </div>
                  <input type="range" min="40" max="85" value={settings.tempWarning} onChange={(e) => updateSetting('tempWarning', parseInt(e.target.value))} />
                </div>
                <div className="threshold-row">
                  <div className="threshold-info">
                    <strong>🌡️ Temp Critical</strong>
                    <span>Current: {settings.tempCritical}°C</span>
                  </div>
                  <input type="range" min="50" max="99" value={settings.tempCritical} onChange={(e) => updateSetting('tempCritical', parseInt(e.target.value))} />
                </div>
              </div>

              <div className="settings-panel-footer">
                <button className="btn-ghost text-red" onClick={handleReset}>Reset Defaults</button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="settings-panel animate-fade-in">
              <div className="settings-panel-header">
                <h3>UI Preferences</h3>
                <p>Customize the presentation and frequency of monitoring updates.</p>
              </div>

              <div className="form-group mt-4">
                <label className="form-label">Active UI Theme</label>
                <div className="theme-toggle-row">
                  <button className="btn-secondary" onClick={toggleTheme}>
                    Toggle Theme Mode (Current: {theme})
                  </button>
                </div>
              </div>

              <div className="form-group mt-4">
                <label className="form-label">Auto Refresh Speed</label>
                <select 
                  className="form-control"
                  value={settings.refreshInterval}
                  onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value))}
                >
                  <option value="2">2 seconds (Real-time)</option>
                  <option value="5">5 seconds</option>
                  <option value="10">10 seconds</option>
                  <option value="30">30 seconds (Eco-mode)</option>
                </select>
              </div>

              <div className="form-group mt-4">
                <label className="form-label">System Preferences</label>
                <div className="checkbox-list">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={settings.notifSound}
                      onChange={(e) => updateSetting('notifSound', e.target.checked)}
                    />
                    Play notification audio chime 🔔
                  </label>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={settings.showUptime}
                      onChange={(e) => updateSetting('showUptime', e.target.checked)}
                    />
                    Display uptime panel
                  </label>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={settings.showServices}
                      onChange={(e) => updateSetting('showServices', e.target.checked)}
                    />
                    Display active services block
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'smtp' && (
            <div className="settings-panel animate-fade-in">
              <div className="settings-panel-header">
                <h3>📧 Email Alert Notifications</h3>
                <p>Choose where to receive warning emails from the ServerPulse website system.</p>
              </div>

              {smtpSuccess && <div className="auth-success-pill mb-4">{smtpSuccess}</div>}
              {smtpError && <div className="auth-error mb-4">{smtpError}</div>}

              {smtpLoading ? (
                <p className="text-muted">Loading alert settings...</p>
              ) : (
                <form onSubmit={handleSaveSmtp} className="settings-account-form">
                  {/* Recipient alert email - Primary input */}
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--color-accent-blue)', fontWeight: 700 }}>
                      Recipient Alert Email (Where to send alerts)
                    </label>
                    <input 
                      type="email" 
                      className="form-control" 
                      placeholder="e.g. your_personal_email@gmail.com" 
                      required
                      value={smtpForm.to} 
                      onChange={(e) => setSmtpForm({ ...smtpForm, to: e.target.value })} 
                      style={{ borderLeft: '3px solid var(--color-accent-blue)' }}
                    />
                    <small style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
                      Critical alerts will be automatically sent to this email directly from the ServerPulse website system.
                    </small>
                  </div>

                  <button type="submit" className="btn-primary mt-6" disabled={smtpLoading}>
                    {smtpLoading ? 'Saving alert setup...' : 'Save Alert settings'}
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'account' && (
            <div className="settings-panel animate-fade-in">
              <div className="settings-panel-header">
                <h3>User Account Administration</h3>
                <p>Configure personal metadata, avatars and account credentials.</p>
              </div>

              {accSuccess && <div className="auth-success-pill mb-4">{accSuccess}</div>}
              {accError && <div className="auth-error mb-4">{accError}</div>}

              <form onSubmit={handleSaveAccount} className="settings-account-form">
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address (readonly)</label>
                  <input type="text" className="form-control" disabled value={user?.email || ''} />
                </div>

                <div className="password-change-block mt-6">
                  <h4 className="section-subtitle-small">Change Account Password</h4>
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="Enter current password to verify"
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="Choose new password (min 6 characters)"
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary mt-6">Save Settings</button>
              </form>

              <div className="danger-zone mt-8">
                <h4 className="danger-title text-red">Danger Area</h4>
                <p className="text-muted">Logging out terminates the active ServerPulse frontend socket monitoring session.</p>
                <button className="btn-secondary mt-2" onClick={logout}>Terminated Session & Logout</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default SettingsPage;

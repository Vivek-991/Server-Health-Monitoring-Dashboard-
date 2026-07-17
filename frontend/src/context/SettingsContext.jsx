import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'shm-settings';

const DEFAULTS = {
  // Alert thresholds
  cpuWarning:    80,
  cpuCritical:   90,
  ramWarning:    80,
  ramCritical:   90,
  diskWarning:   75,
  diskCritical:  90,
  tempWarning:   75,
  tempCritical:  90,

  // Preferences
  refreshInterval: 2,       // seconds
  notifSound:      false,
  compactSidebar:  false,
  showUptime:      true,
  showServices:    true,
  dateFormat:      'en-US', // locale
};

const load = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
};

export const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings({ ...DEFAULTS });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetToDefaults, DEFAULTS }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};

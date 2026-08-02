import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authApi } from '../api/metricsApi';

export const AuthContext = createContext(null);

const TOKEN_KEY = 'shd-token';
const USER_KEY = 'shm-user';

const loadToken = () => localStorage.getItem(TOKEN_KEY);
const saveToken = (t) => { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); };
const loadUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
const saveUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));
const clearAuth = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(loadUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = loadToken();
    if (token) {
      authApi.getMe()
        .then((res) => {
          setUser(res.data.user);
          saveUser(res.data.user);
        })
        .catch(() => {
          clearAuth();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    try {
      const res = await authApi.register({ name, email, password });
      saveToken(res.token);
      saveUser(res.data.user);
      setUser(res.data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const login = useCallback(async ({ email, password }) => {
    try {
      const res = await authApi.login({ email, password });
      saveToken(res.token);
      saveUser(res.data.user);
      setUser(res.data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export const AuthContext = createContext(null);

// ── Helpers ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'shm-user';

const loadUser = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch { return null; }
};

const saveUser = (u) => localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
const clearUser = () => localStorage.removeItem(STORAGE_KEY);

// Very simple "mock" user store (persisted in localStorage)
const USERS_KEY = 'shm-users';
const loadUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; } };
const saveUsers = (users) => localStorage.setItem(USERS_KEY, JSON.stringify(users));

// ── Provider ──────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(loadUser);

  // Keep localStorage in sync
  useEffect(() => {
    if (user) saveUser(user);
    else clearUser();
  }, [user]);

  const signup = useCallback(({ name, email, password }) => {
    if (!name || !email || !password)
      return { ok: false, error: 'All fields are required.' };
    if (password.length < 6)
      return { ok: false, error: 'Password must be at least 6 characters.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { ok: false, error: 'Please enter a valid email address.' };

    const users = loadUsers();
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase()))
      return { ok: false, error: 'An account with this email already exists.' };

    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      avatar: name.charAt(0).toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    saveUsers([...users, { ...newUser, password }]);
    setUser(newUser);
    return { ok: true };
  }, []);

  const login = useCallback(({ email, password }) => {
    if (!email || !password)
      return { ok: false, error: 'Email and password are required.' };

    const users = loadUsers();
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return { ok: false, error: 'Invalid email or password.' };

    const { password: _pw, ...safeUser } = found;
    setUser(safeUser);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

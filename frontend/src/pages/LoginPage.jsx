import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useActivity } from '../context/ActivityContext';
import '../styles/auth.css';

// ── Sub-form: Login ───────────────────────────────────────────────────────────
const LoginForm = ({ onSwitch }) => {
  const { login } = useAuth();
  const { addLog } = useActivity();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = login(fields);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
    } else {
      addLog('auth', 'User logged in', fields.email);
      navigate('/', { replace: true }); // redirect to dashboard
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="auth-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="auth-field">
        <label className="auth-label" htmlFor="login-email">Email address</label>
        <div className="auth-input-wrapper">
          <span className="auth-input-icon">📧</span>
          <input
            id="login-email"
            className={`auth-input${error ? ' error' : ''}`}
            type="email"
            placeholder="you@example.com"
            value={fields.email}
            onChange={set('email')}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="login-password">Password</label>
        <div className="auth-input-wrapper">
          <span className="auth-input-icon">🔑</span>
          <input
            id="login-password"
            className={`auth-input${error ? ' error' : ''}`}
            type={showPw ? 'text' : 'password'}
            placeholder="Enter your password"
            value={fields.password}
            onChange={set('password')}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
            aria-label="Toggle password visibility"
          >
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <button className="auth-submit" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In →'}
      </button>

      <div className="auth-toggle">
        Don't have an account?{' '}
        <button type="button" className="auth-toggle-btn" onClick={onSwitch}>
          Sign up free
        </button>
      </div>
    </form>
  );
};

// ── Sub-form: Signup ──────────────────────────────────────────────────────────
const SignupForm = ({ onSwitch }) => {
  const { signup } = useAuth();
  const { addLog } = useActivity();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = signup(fields);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
    } else {
      addLog('auth', 'New user registered', fields.email);
      navigate('/', { replace: true }); // redirect to dashboard
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="auth-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-name">Full name</label>
        <div className="auth-input-wrapper">
          <span className="auth-input-icon">👤</span>
          <input
            id="signup-name"
            className={`auth-input${error ? ' error' : ''}`}
            type="text"
            placeholder="Jane Smith"
            value={fields.name}
            onChange={set('name')}
            autoComplete="name"
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-email">Email address</label>
        <div className="auth-input-wrapper">
          <span className="auth-input-icon">📧</span>
          <input
            id="signup-email"
            className={`auth-input${error ? ' error' : ''}`}
            type="email"
            placeholder="you@example.com"
            value={fields.email}
            onChange={set('email')}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-password">
          Password{' '}
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            (min 6 chars)
          </span>
        </label>
        <div className="auth-input-wrapper">
          <span className="auth-input-icon">🔑</span>
          <input
            id="signup-password"
            className={`auth-input${error ? ' error' : ''}`}
            type={showPw ? 'text' : 'password'}
            placeholder="Create a password"
            value={fields.password}
            onChange={set('password')}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
            aria-label="Toggle password visibility"
          >
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <button className="auth-submit" type="submit" disabled={loading}>
        {loading ? 'Creating account…' : 'Create Account →'}
      </button>

      <div className="auth-toggle">
        Already have an account?{' '}
        <button type="button" className="auth-toggle-btn" onClick={onSwitch}>
          Sign in
        </button>
      </div>
    </form>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  // Already logged in → go straight to dashboard
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">⚡</div>
          <div className="auth-logo-text">
            ServerPulse
            <span>Health Monitor</span>
          </div>
        </div>

        {/* Header */}
        <div className="auth-header">
          <h1 className="auth-title">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Sign in to access your server dashboard'
              : 'Join to monitor your server health in real-time'}
          </p>
        </div>

        {/* Form */}
        {mode === 'login'
          ? <LoginForm onSwitch={() => setMode('signup')} />
          : <SignupForm onSwitch={() => setMode('login')} />}
      </div>
    </div>
  );
};

export default LoginPage;

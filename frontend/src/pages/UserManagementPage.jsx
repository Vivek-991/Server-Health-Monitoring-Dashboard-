import React, { useState, useCallback } from 'react';
import PageLayout from '../components/common/PageLayout';
import { useAuth } from '../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const USERS_KEY = 'shm-users';
const loadUsers  = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; } };
const saveUsers  = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));

const Avatar = ({ letter, color = '#6384ff' }) => (
  <div className="um-avatar" style={{ background: `linear-gradient(135deg, ${color}, #a855f7)` }}>
    {letter}
  </div>
);

const ROLE_COLORS = { Admin: '#6384ff', Viewer: '#22c55e', Editor: '#f59e0b' };

// ── Add User Modal ─────────────────────────────────────────────────────────────
const AddUserModal = ({ onClose, onAdd }) => {
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'Viewer' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!f.name || !f.email || !f.password) { setErr('All fields are required.'); return; }
    if (f.password.length < 6) { setErr('Password must be at least 6 chars.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { setErr('Invalid email.'); return; }
    const users = loadUsers();
    if (users.find((u) => u.email.toLowerCase() === f.email.toLowerCase())) { setErr('Email already exists.'); return; }
    const newUser = { id: Date.now().toString(), name: f.name, email: f.email, password: f.password, role: f.role, avatar: f.name[0].toUpperCase(), createdAt: new Date().toISOString(), active: true };
    saveUsers([...users, newUser]);
    onAdd();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">➕ Add User</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          {err && <div className="modal-error">⚠️ {err}</div>}
          {[['name','Full Name','text','Jane Smith'],['email','Email','email','jane@example.com'],['password','Password','password','min 6 chars']].map(([k,label,type,ph]) => (
            <div className="modal-field" key={k}>
              <label>{label}</label>
              <input type={type} placeholder={ph} value={f[k]} onChange={set(k)} />
            </div>
          ))}
          <div className="modal-field">
            <label>Role</label>
            <select value={f.role} onChange={set('role')}>
              <option value="Viewer">Viewer</option>
              <option value="Editor">Editor</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create User</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const UserManagementPage = () => {
  const { user: me } = useAuth();
  const [users, setUsers]     = useState(loadUsers);
  const [search, setSearch]   = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const refresh = useCallback(() => setUsers(loadUsers()), []);

  const toggleActive = (id) => {
    const updated = loadUsers().map((u) => u.id === id ? { ...u, active: !u.active } : u);
    saveUsers(updated); setUsers(updated);
  };

  const deleteUser = (id) => {
    if (!window.confirm('Delete this user permanently?')) return;
    const updated = loadUsers().filter((u) => u.id !== id);
    saveUsers(updated); setUsers(updated);
  };

  const changeRole = (id, role) => {
    const updated = loadUsers().map((u) => u.id === id ? { ...u, role } : u);
    saveUsers(updated); setUsers(updated);
  };

  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 User Management</h1>
          <p className="page-sub">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>➕ Add User</button>
      </div>

      {/* Search */}
      <div className="um-search-row">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="um-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="card table-card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">No users found</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className={!u.active ? 'row-inactive' : ''}>
                  <td>
                    <div className="um-user-cell">
                      <Avatar letter={u.avatar || u.name?.[0] || '?'} color={ROLE_COLORS[u.role] || '#6384ff'} />
                      <span className="um-name">{u.name}{u.id === me?.id && <span className="um-you-tag">you</span>}</span>
                    </div>
                  </td>
                  <td className="td-mono">{u.email}</td>
                  <td>
                    <select
                      className="role-select"
                      value={u.role || 'Viewer'}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      disabled={u.id === me?.id}
                      style={{ color: ROLE_COLORS[u.role] || '#6384ff' }}
                    >
                      <option value="Viewer">Viewer</option>
                      <option value="Editor">Editor</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </td>
                  <td className="td-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <span className={`status-pill ${u.active !== false ? 'active' : 'inactive'}`}>
                      {u.active !== false ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns">
                      {u.id !== me?.id && (
                        <>
                          <button className="act-btn" onClick={() => toggleActive(u.id)} title={u.active !== false ? 'Deactivate' : 'Activate'}>
                            {u.active !== false ? '⏸' : '▶'}
                          </button>
                          <button className="act-btn danger" onClick={() => deleteUser(u.id)} title="Delete">🗑</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onAdd={refresh} />}
    </PageLayout>
  );
};

export default UserManagementPage;

import React, { useState, useEffect, useCallback } from 'react';
import PageLayout from '../components/common/PageLayout';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/metricsApi';

const Avatar = ({ letter, color = '#6384ff' }) => (
  <div className="um-avatar" style={{ background: `linear-gradient(135deg, ${color}, #a855f7)` }}>
    {letter}
  </div>
);

const ROLE_COLORS = { admin: '#6384ff', viewer: '#22c55e', editor: '#f59e0b', Admin: '#6384ff', Viewer: '#22c55e', Editor: '#f59e0b' };

// ── Add User Modal ─────────────────────────────────────────────────────────────
const AddUserModal = ({ onClose, onAdd }) => {
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name || !f.email || !f.password) { setErr('All fields are required.'); return; }
    if (f.password.length < 6) { setErr('Password must be at least 6 chars.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { setErr('Invalid email.'); return; }
    try {
      await userApi.create(f);
      onAdd();
      onClose();
    } catch (error) {
      setErr(error.message || 'Failed to create user');
    }
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
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
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
  const [users, setUsers]     = useState([]);
  const [search, setSearch]   = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await userApi.list();
      if (res?.data) {
        setUsers(res.data);
      }
    } catch {
      // Fallback if network or auth error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleActive = async (u) => {
    try {
      await userApi.update(u.id || u._id, { isActive: !u.isActive });
      fetchUsers();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user permanently from backend?')) return;
    try {
      await userApi.delete(id);
      fetchUsers();
    } catch (err) {
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  const changeRole = async (id, role) => {
    try {
      await userApi.update(id, { role: role.toLowerCase() });
      fetchUsers();
    } catch (err) {
      alert(`Failed to update role: ${err.message}`);
    }
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
          <p className="page-sub">{users.length} registered user{users.length !== 1 ? 's' : ''} in database</p>
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
              {loading ? (
                <tr><td colSpan={6} className="table-empty">Loading user accounts...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">No users found</td></tr>
              ) : filtered.map((u) => {
                const uId = u.id || u._id;
                const isMe = uId === me?.id || uId === me?._id;
                return (
                  <tr key={uId} className={u.isActive === false ? 'row-inactive' : ''}>
                    <td>
                      <div className="um-user-cell">
                        <Avatar letter={u.name?.[0]?.toUpperCase() || '?'} color={ROLE_COLORS[u.role] || '#6384ff'} />
                        <span className="um-name">{u.name}{isMe && <span className="um-you-tag">you</span>}</span>
                      </div>
                    </td>
                    <td className="td-mono">{u.email}</td>
                    <td>
                      <select
                        className="role-select"
                        value={u.role ? u.role.toLowerCase() : 'viewer'}
                        onChange={(e) => changeRole(uId, e.target.value)}
                        disabled={isMe}
                        style={{ color: ROLE_COLORS[u.role] || '#6384ff' }}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="td-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={`status-pill ${u.isActive !== false ? 'active' : 'inactive'}`}>
                        {u.isActive !== false ? '● Active' : '○ Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        {!isMe && (
                          <>
                            <button className="act-btn" onClick={() => toggleActive(u)} title={u.isActive !== false ? 'Deactivate' : 'Activate'}>
                              {u.isActive !== false ? '⏸' : '▶'}
                            </button>
                            <button className="act-btn danger" onClick={() => deleteUser(uId)} title="Delete">🗑</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onAdd={fetchUsers} />}
    </PageLayout>
  );
};

export default UserManagementPage;

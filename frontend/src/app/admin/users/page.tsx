'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { Pagination } from '@/components/Pagination';

const ROLES = ['ADMIN', 'MANAGER', 'CASHIER'];
const LIMIT = 20;

const emptyForm = { username: '', password: '', name: '', role: 'CASHIER' };

export default function UsersAdmin() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const load = useCallback((p = page) => {
    setLoading(true);
    api.users.getAll(p, LIMIT)
      .then((res: any) => {
        setUsers(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    setCurrentUser(auth.getUser());
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setForm({ username: u.username, password: '', name: u.name, role: u.role });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (editing) {
        const data: any = { name: form.name, role: form.role };
        if (form.password) data.password = form.password;
        await api.users.update(editing.id, data);
      } else {
        await api.users.create(form);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: any) => {
    try {
      await api.users.update(u.id, { isActive: !u.isActive });
      load();
    } catch (e: any) {
      alert(e.message || 'Failed');
    }
  };

  const handleDelete = async (u: any) => {
    if (u.id === currentUser?.id) return alert("You can't delete your own account.");
    if (!confirm(`Delete user "${u.username}"?`)) return;
    try {
      await api.users.delete(u.id);
      load();
    } catch (e: any) {
      alert(e.message || 'Delete failed');
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-red-100 text-red-700',
      MANAGER: 'bg-blue-100 text-blue-700',
      CASHIER: 'bg-gray-100 text-gray-600',
    };
    return colors[role] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Users</h2>
        <button onClick={openCreate} className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Add User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {u.name}
                    {u.id === currentUser?.id && <span className="ml-2 text-xs text-blue-500">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleToggleActive(u)} className="text-yellow-600 hover:underline">
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    {u.id !== currentUser?.id && (
                      <button onClick={() => handleDelete(u)} className="text-red-500 hover:underline">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPageChange={p => setPage(p)}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{editing ? 'Edit User' : 'Add User'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded mb-3">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  disabled={!!editing}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {editing ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-blue-700 hover:bg-blue-600 text-white rounded-lg disabled:opacity-60">
                {saving ? 'Saving...' : 'Save User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

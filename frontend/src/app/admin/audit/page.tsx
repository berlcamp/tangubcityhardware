'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

const ACTION_COLORS: Record<string, string> = {
  SALE_CREATED: 'bg-blue-100 text-blue-700',
  STOCK_ADJUSTED: 'bg-green-100 text-green-700',
  PRODUCT_CREATED: 'bg-purple-100 text-purple-700',
  PRODUCT_UPDATED: 'bg-yellow-100 text-yellow-700',
  PRODUCT_DELETED: 'bg-red-100 text-red-700',
  USER_LOGIN: 'bg-gray-100 text-gray-700',
  USER_CREATED: 'bg-indigo-100 text-indigo-700',
  USER_UPDATED: 'bg-indigo-100 text-indigo-700',
  USER_DELETED: 'bg-red-100 text-red-700',
};

const ACTIONS = [
  'SALE_CREATED', 'STOCK_ADJUSTED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED',
  'PRODUCT_DELETED', 'USER_LOGIN', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
];

const today = new Date().toISOString().split('T')[0];
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState(sevenDaysAgo);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.audit.getAll(page, 50, { action: action || undefined, from, to });
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, action, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [action, from, to]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Audit Log</h2>
        <p className="text-sm text-gray-500">Complete record of all system actions</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Action</label>
          <select value={action} onChange={e => setAction(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All actions</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">From</label>
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">To</label>
          <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <span className="text-xs text-gray-400 ml-auto">{total} records</span>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Timestamp</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <>
                  <tr key={log.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-2 font-medium">{log.userName || <span className="text-gray-400">system</span>}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{log.entityType || '—'}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-xs">
                      {log.details ? JSON.stringify(log.details).slice(0, 60) + (JSON.stringify(log.details).length > 60 ? '…' : '') : '—'}
                    </td>
                  </tr>
                  {expanded === log.id && log.details && (
                    <tr key={`${log.id}-exp`} className="bg-gray-50 border-b">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs text-gray-700 bg-white border rounded-lg p-3 overflow-auto max-h-40">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">{total} total records</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border rounded disabled:opacity-40">Prev</button>
            <span className="px-3 py-1.5">Page {page} of {Math.ceil(total / 50)}</span>
            <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

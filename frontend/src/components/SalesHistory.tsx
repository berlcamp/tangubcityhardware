'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

interface Props {
  onClose: () => void;
  cashier?: string;
}

const LIMIT = 20;

const PAYMENT_COLORS: Record<string, string> = {
  cash:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  gcash: 'bg-blue-50 text-blue-700 border-blue-200',
  card:  'bg-violet-50 text-violet-700 border-violet-200',
};

const todayStr = () => new Date().toISOString().split('T')[0];

export function SalesHistory({ onClose, cashier }: Props) {
  const [sales, setSales] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const user = auth.getUser();
  const canVoid = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await api.sales.getAll(p, LIMIT, cashier, todayStr());
      setSales(res.data || res.sales || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch {
      // offline
    }
    setLoading(false);
  }, [cashier]);

  useEffect(() => { load(page); }, [load, page]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleVoid = async (sale: any) => {
    if (!confirm(`Void receipt ${sale.receiptNumber}? This will restore inventory and refund PHP ${Number(sale.total).toFixed(2)}.`)) return;
    setVoidingId(sale.id);
    try {
      await api.sales.voidSale(sale.id, { userId: user?.id, userName: user?.name, reason: 'Void by manager' });
      await load(page);
    } catch (err: any) {
      alert(err.message || 'Void failed');
    } finally {
      setVoidingId(null);
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="modal-panel bg-white rounded-2xl w-full max-w-3xl flex flex-col overflow-hidden"
        style={{ maxHeight: '82vh', boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
             style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Sales Today</h2>
            {!loading && (
              <p className="text-xs text-slate-500 mt-0.5">{total} transaction{total !== 1 ? 's' : ''} today</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <svg className="animate-spin w-6 h-6 mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span className="text-sm">Loading transactions...</span>
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No transactions yet</p>
              <p className="text-xs text-slate-400 mt-1">Completed sales will appear here</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}
                    className="border-b border-slate-200 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Receipt #</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment</th>
                  {canVoid && (
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className={`hover:bg-slate-50 transition-colors ${sale.isVoided ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-3.5 font-code text-xs text-slate-600 tracking-wide">
                      {sale.receiptNumber}
                      {sale.isVoided && <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">VOIDED</span>}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {sale.items?.length ?? 0} item{(sale.items?.length ?? 0) !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-3.5 text-right font-amount font-semibold text-slate-800">
                      PHP {Number(sale.total).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${
                        PAYMENT_COLORS[sale.paymentMethod] ?? 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>
                    {canVoid && (
                      <td className="px-6 py-3.5">
                        {!sale.isVoided && (
                          <button
                            onClick={() => handleVoid(sale)}
                            disabled={voidingId === sale.id}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-40"
                          >
                            {voidingId === sale.id ? '...' : 'Void'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50 text-sm">
            <span className="text-xs text-slate-500">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-xs text-slate-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

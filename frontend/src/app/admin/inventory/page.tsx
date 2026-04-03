'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Pagination } from '@/components/Pagination';

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  SALE:       'bg-red-50 text-red-700 border-red-200',
  RESTOCK:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADJUSTMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  RETURN:     'bg-blue-50 text-blue-700 border-blue-200',
};

const LIMIT = 20;

export default function InventoryAdmin() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [allInventory, setAllInventory] = useState<any[]>([]); // for Receive Stock dropdown
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Adjust modal state
  const [adjusting, setAdjusting] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustType, setAdjustType] = useState<'RESTOCK' | 'ADJUSTMENT'>('RESTOCK');
  const [saving, setSaving] = useState(false);

  // Receive stock modal
  const [showReceive, setShowReceive] = useState(false);
  const [receiveProduct, setReceiveProduct] = useState('');
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveReason, setReceiveReason] = useState('Purchase');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiveSaving, setReceiveSaving] = useState(false);

  // History modal
  const [historyProduct, setHistoryProduct] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (historyProduct) { setHistoryProduct(null); setHistory([]); }
      else if (adjusting) { setAdjusting(null); setAdjustQty(''); setAdjustReason(''); }
      else if (showReceive) { setShowReceive(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyProduct, adjusting, showReceive]);

  const load = useCallback((p = page, s = search) => {
    setLoading(true);
    api.inventory.getAll(p, LIMIT, s || undefined)
      .then((res: any) => {
        setInventory(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Load all inventory once for the Receive Stock dropdown
  useEffect(() => {
    api.inventory.getAll(1, 1000).then((res: any) => setAllInventory(res.data || [])).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openHistory = async (item: any) => {
    setHistoryProduct(item);
    setHistoryLoading(true);
    try {
      const res = await api.reports.inventoryMovements(item.productId, undefined, undefined, 1, 20);
      setHistory(res.data || res);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReceiveStock = async () => {
    if (!receiveProduct || !receiveQty) return;
    setReceiveSaving(true);
    try {
      const reason = `${receiveReason}${receiveNotes ? ': ' + receiveNotes : ''}`;
      await api.inventory.adjust(receiveProduct, Math.abs(Number(receiveQty)), reason);
      setShowReceive(false);
      setReceiveProduct('');
      setReceiveQty('');
      setReceiveNotes('');
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to receive stock');
    } finally {
      setReceiveSaving(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjusting || adjustQty === '') return;
    setSaving(true);
    try {
      const qty = adjustType === 'RESTOCK' ? Math.abs(Number(adjustQty)) : -Math.abs(Number(adjustQty));
      await api.inventory.adjust(adjusting.productId, qty, adjustReason || adjustType);
      setAdjusting(null);
      setAdjustQty('');
      setAdjustReason('');
      load();
    } catch (e: any) {
      alert(e.message || 'Adjust failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Inventory</h2>
        <button
          onClick={() => setShowReceive(true)}
          className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow"
        >
          + Receive Stock
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search products..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Min Threshold</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => {
                const qty = Number(item.quantity);
                const low = Number(item.lowStock);
                const isLow = qty <= low;
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{item.product?.name}</td>
                    <td className="px-4 py-3 text-gray-500">{item.product?.sku}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${isLow ? 'text-red-500' : 'text-gray-800'}`}>{qty}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{low}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isLow ? 'Low Stock' : 'OK'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => openHistory(item)} className="text-gray-500 hover:text-gray-700 text-sm">History</button>
                      <button onClick={() => { setAdjusting(item); setAdjustQty(''); setAdjustReason(''); setAdjustType('RESTOCK'); }} className="text-blue-600 hover:underline text-sm">Adjust</button>
                    </td>
                  </tr>
                );
              })}
              {inventory.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No inventory records</td></tr>
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

      {/* Receive Stock Modal */}
      {showReceive && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="modal-panel bg-white rounded-2xl w-full max-w-sm overflow-hidden"
            style={{ boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                 style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
              <div>
                <h3 className="font-semibold text-slate-900 tracking-tight">Receive Stock</h3>
                <p className="text-xs text-slate-500 mt-0.5">Record incoming inventory</p>
              </div>
              <button
                onClick={() => setShowReceive(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Product</label>
                <select
                  value={receiveProduct}
                  onChange={e => setReceiveProduct(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white"
                >
                  <option value="">Select product…</option>
                  {allInventory.map(item => (
                    <option key={item.productId} value={item.productId}>
                      {item.product?.name} (stock: {Number(item.quantity)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Quantity Received</label>
                <input
                  type="number"
                  min="1"
                  value={receiveQty}
                  onChange={e => setReceiveQty(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reason</label>
                <select
                  value={receiveReason}
                  onChange={e => setReceiveReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white"
                >
                  <option>Purchase</option>
                  <option>Return</option>
                  <option>Transfer In</option>
                  <option>Correction</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Notes <span className="text-slate-400 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={receiveNotes}
                  onChange={e => setReceiveNotes(e.target.value)}
                  placeholder="Supplier name, PO reference…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => setShowReceive(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReceiveStock}
                disabled={receiveSaving || !receiveProduct || !receiveQty}
                className="px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-emerald-200"
              >
                {receiveSaving ? 'Saving…' : 'Receive Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjusting && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="modal-panel bg-white rounded-2xl w-full max-w-sm overflow-hidden"
            style={{ boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                 style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
              <div>
                <h3 className="font-semibold text-slate-900 tracking-tight">Adjust Stock</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">
                  {adjusting.product?.name} · current: <span className="font-semibold text-slate-700">{Number(adjusting.quantity)}</span>
                </p>
              </div>
              <button
                onClick={() => setAdjusting(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Adjustment Type</p>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => setAdjustType('RESTOCK')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                      adjustType === 'RESTOCK'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    + Add Stock
                  </button>
                  <button
                    onClick={() => setAdjustType('ADJUSTMENT')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                      adjustType === 'ADJUSTMENT'
                        ? 'bg-white text-red-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    − Remove Stock
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Reason <span className="text-slate-400 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="e.g. damaged goods, count correction"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => setAdjusting(null)}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                disabled={saving || adjustQty === ''}
                className="px-5 py-2.5 text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
              >
                {saving ? 'Saving…' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyProduct && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="modal-panel bg-white rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden"
            style={{ boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                 style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
              <div>
                <h3 className="font-semibold text-slate-900 tracking-tight">Movement History</h3>
                <p className="text-xs text-slate-500 mt-0.5">{historyProduct.product?.name}</p>
              </div>
              <button
                onClick={() => { setHistoryProduct(null); setHistory([]); }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <svg className="animate-spin w-6 h-6 mb-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="text-sm">Loading history…</span>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No movement history yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}
                        className="border-b border-slate-200 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Change</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Before</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">After</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((m: any) => {
                      const qty = Number(m.quantity);
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${MOVEMENT_TYPE_COLORS[m.type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {m.type}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold font-amount ${qty >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {qty >= 0 ? '+' : ''}{qty}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400 text-xs">{Number(m.previousQty)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">{Number(m.newQty)}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px] truncate">{m.reason || '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{m.userName || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

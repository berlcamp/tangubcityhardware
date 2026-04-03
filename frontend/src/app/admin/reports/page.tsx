'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

const today = new Date().toISOString().split('T')[0];
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

type Tab = 'sales' | 'transactions' | 'products' | 'inventory' | 'cashier';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('sales');
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<any>(null);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [movPage, setMovPage] = useState(1);
  const [cashierData, setCashierData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnTotalPages, setTxnTotalPages] = useState(1);
  const [txnPage, setTxnPage] = useState(1);
  const [txnDate, setTxnDate] = useState(today);
  const [txnSearch, setTxnSearch] = useState('');
  const [txnSearchInput, setTxnSearchInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Return modal state
  const [returnModal, setReturnModal] = useState<{ sale: any } | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const user = auth.getUser();

  const loadSalesData = useCallback(async () => {
    setLoading(true);
    try {
      const days = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const [s, d] = await Promise.all([
        api.reports.salesSummary(from, to),
        api.reports.salesByDay(Math.min(days, 90)),
      ]);
      setSummary(s);
      setDailySales(d.filter((r: any) => r.date >= from && r.date <= to));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const loadProductsData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.reports.topProducts(20, from, to);
      setTopProducts(data);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const loadInventoryData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.reports.inventoryMovements(undefined, from, to, movPage, 50);
      setMovements(res.data || []);
      setMovementsTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [from, to, movPage]);

  const loadTransactionsData = useCallback(async () => {
    setLoading(true);
    try {
      if (txnSearch) {
        const sale = await api.sales.getByReceipt(txnSearch).catch(() => null);
        setTransactions(sale ? [sale] : []);
        setTxnTotal(sale ? 1 : 0);
        setTxnTotalPages(1);
      } else {
        const res = await api.reports.transactions(txnDate, txnPage, 20);
        setTransactions(res.data || []);
        setTxnTotal(res.total || 0);
        setTxnTotalPages(res.totalPages || 1);
      }
    } finally {
      setLoading(false);
    }
  }, [txnDate, txnPage, txnSearch]);

  const handleTxnSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const val = txnSearchInput.trim().toUpperCase();
    setTxnSearch(val);
    setTxnPage(1);
  };

  const clearTxnSearch = () => {
    setTxnSearchInput('');
    setTxnSearch('');
    setTxnPage(1);
  };

  const openReturnModal = (sale: any) => {
    const qtys: Record<string, number> = {};
    sale.items?.forEach((item: any) => { qtys[item.id] = 0; });
    setReturnQtys(qtys);
    setReturnReason('');
    setReturnError(null);
    setReturnModal({ sale });
  };

  const handleReturn = async () => {
    if (!returnModal) return;
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));
    if (items.length === 0) { setReturnError('Select at least one item to return'); return; }

    setReturning(true);
    setReturnError(null);
    try {
      await api.sales.returnItems(returnModal.sale.id, {
        items,
        reason: returnReason || undefined,
        userId: user?.id,
        userName: user?.name,
      });
      setReturnModal(null);
      loadTransactionsData();
    } catch (err: any) {
      setReturnError(err.message || 'Return failed');
    } finally {
      setReturning(false);
    }
  };

  const returnRefundTotal = returnModal
    ? Object.entries(returnQtys).reduce((sum, [id, qty]) => {
        const item = returnModal.sale.items?.find((i: any) => i.id === id);
        if (!item || qty <= 0) return sum;
        return sum + (qty / Number(item.quantity)) * Number(item.total);
      }, 0)
    : 0;

  const loadCashierData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.reports.salesByCashier(from, to);
      setCashierData(data);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (tab === 'sales') loadSalesData();
    else if (tab === 'transactions') loadTransactionsData();
    else if (tab === 'products') loadProductsData();
    else if (tab === 'cashier') loadCashierData();
    else loadInventoryData();
  }, [tab, from, to, loadSalesData, loadTransactionsData, loadProductsData, loadInventoryData, loadCashierData]);

  const formatPHP = (v: number) => v.toLocaleString('en-PH', { minimumFractionDigits: 2 });

  const MOVEMENT_TYPE_COLORS: Record<string, string> = {
    SALE: 'bg-red-100 text-red-700',
    RESTOCK: 'bg-green-100 text-green-700',
    ADJUSTMENT: 'bg-yellow-100 text-yellow-700',
    RETURN: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Reports</h2>
      </div>

      {/* Date Range */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-5 flex items-center gap-4">
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
        <div className="flex gap-2 ml-auto">
          {[{ label: 'Today', days: 0 }, { label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: '90 days', days: 90 }].map(({ label, days }) => (
            <button key={label} onClick={() => {
              const f = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              setFrom(days === 0 ? today : f);
              setTo(today);
            }}
              className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {[['sales', 'Sales'], ['transactions', 'Transactions'], ['products', 'Top Products'], ['cashier', 'By Cashier'], ['inventory', 'Inventory Movements']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as Tab)}
            className={`px-4 py-2 text-sm rounded-md transition ${tab === key ? 'bg-white shadow font-medium text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-gray-400">Loading...</div>}

      {/* Sales Tab */}
      {!loading && tab === 'sales' && (
        <div className="space-y-5">
          {summary && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Transactions</div>
                <div className="text-3xl font-bold text-blue-700 mt-1">{summary.totalTransactions}</div>
              </div>
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Revenue</div>
                <div className="text-3xl font-bold text-green-600 mt-1">₱{formatPHP(summary.totalRevenue)}</div>
              </div>
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Avg per Transaction</div>
                <div className="text-3xl font-bold text-gray-700 mt-1">₱{formatPHP(summary.avgTransaction)}</div>
              </div>
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Cost (COGS)</div>
                <div className="text-3xl font-bold text-orange-600 mt-1">₱{formatPHP(summary.totalCost ?? 0)}</div>
              </div>
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Gross Profit</div>
                <div className={`text-3xl font-bold mt-1 ${(summary.totalProfit ?? 0) >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                  ₱{formatPHP(summary.totalProfit ?? 0)}
                </div>
                <div className="text-xs text-gray-400 mt-1">{summary.profitMargin ?? 0}% margin</div>
              </div>
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Discounts</div>
                <div className="text-3xl font-bold text-red-500 mt-1">₱{formatPHP(summary.totalDiscount ?? 0)}</div>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 text-sm font-medium text-gray-700">Daily Sales</div>
            <table className="w-full text-sm">
              <thead className="border-b text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Transactions</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dailySales.filter(d => d.count > 0).map((row: any) => (
                  <tr key={row.date} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2">{new Date(row.date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                    <td className="px-4 py-2 text-right font-medium text-green-700">₱{formatPHP(row.revenue)}</td>
                  </tr>
                ))}
                {dailySales.filter(d => d.count > 0).length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No sales in this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {!loading && tab === 'transactions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 flex-wrap">
            <form onSubmit={handleTxnSearch} className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium whitespace-nowrap">Receipt #</label>
              <input
                type="text"
                value={txnSearchInput}
                onChange={e => setTxnSearchInput(e.target.value)}
                placeholder="e.g. 20260404-0001"
                className="border rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                Search
              </button>
              {txnSearch && (
                <button type="button" onClick={clearTxnSearch}
                  className="px-3 py-1.5 border text-sm rounded-lg text-gray-500 hover:bg-gray-50">
                  Clear
                </button>
              )}
            </form>
            {!txnSearch && (
              <div className="flex items-center gap-2 border-l pl-4">
                <label className="text-sm text-gray-600 font-medium">Date</label>
                <input
                  type="date"
                  value={txnDate}
                  max={today}
                  onChange={e => { setTxnDate(e.target.value); setTxnPage(1); }}
                  className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <span className="text-sm text-gray-400 ml-auto">
              {txnSearch ? (txnTotal === 0 ? 'Not found' : '1 result') : `${txnTotal} transaction${txnTotal !== 1 ? 's' : ''}`}
            </span>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Receipt #</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Cashier</th>
                  <th className="px-4 py-3 text-left">Items</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn: any) => (
                  <tr key={txn.id} className={`border-b last:border-0 hover:bg-gray-50 ${txn.isVoided ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs text-blue-700 font-medium">
                      {txn.receiptNumber}
                      {txn.isVoided && <span className="ml-1 px-1 py-0.5 bg-red-100 text-red-600 rounded text-xs">VOIDED</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(txn.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2">{txn.cashier || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="space-y-0.5">
                        {txn.items?.slice(0, 3).map((item: any) => (
                          <div key={item.id} className="text-xs text-gray-600">
                            {item.product?.name} <span className="text-gray-400">×{Number(item.quantity)}</span>
                          </div>
                        ))}
                        {txn.items?.length > 3 && (
                          <div className="text-xs text-gray-400">+{txn.items.length - 3} more</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                        txn.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700' :
                        txn.paymentMethod === 'gcash' ? 'bg-blue-50 text-blue-700' :
                        'bg-violet-50 text-violet-700'
                      }`}>{txn.paymentMethod}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">₱{formatPHP(Number(txn.subtotal))}</td>
                    <td className="px-4 py-2 text-right text-red-500">
                      {Number(txn.discount) > 0 ? `−₱${formatPHP(Number(txn.discount))}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-green-700">₱{formatPHP(Number(txn.total))}</td>
                    <td className="px-4 py-2">
                      {!txn.isVoided && (
                        <button
                          onClick={() => openReturnModal(txn)}
                          className="px-2.5 py-1 text-xs bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No transactions on this date</td></tr>
                )}
              </tbody>
              {transactions.length > 0 && (
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">
                      Page total
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-600">
                      ₱{formatPHP(transactions.reduce((s, t) => s + Number(t.subtotal), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">
                      −₱{formatPHP(transactions.reduce((s, t) => s + Number(t.discount), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">
                      ₱{formatPHP(transactions.reduce((s, t) => s + Number(t.total), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {txnTotalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{txnTotal} total · page {txnPage} of {txnTotalPages}</span>
              <div className="flex gap-2">
                <button disabled={txnPage <= 1} onClick={() => setTxnPage(p => p - 1)}
                  className="px-3 py-1.5 border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <button disabled={txnPage >= txnTotalPages} onClick={() => setTxnPage(p => p + 1)}
                  className="px-3 py-1.5 border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Products Tab */}
      {!loading && tab === 'products' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left w-8">#</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-right">Units Sold</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p: any, i: number) => (
                <tr key={p.productId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3 text-right">{Number(p.totalQty).toFixed(0)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">₱{formatPHP(p.totalRevenue)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">₱{formatPHP(p.totalCost ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-medium text-indigo-700">₱{formatPHP(p.totalProfit ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{p.profitMargin ?? 0}%</td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No sales data in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* By Cashier Tab */}
      {!loading && tab === 'cashier' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left w-8">#</th>
                <th className="px-4 py-3 text-left">Cashier</th>
                <th className="px-4 py-3 text-right">Transactions</th>
                <th className="px-4 py-3 text-right">Total Revenue</th>
                <th className="px-4 py-3 text-right">Total Discounts</th>
                <th className="px-4 py-3 text-right">Avg per Transaction</th>
              </tr>
            </thead>
            <tbody>
              {cashierData.map((row: any, i: number) => (
                <tr key={row.cashier} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{row.cashier}</td>
                  <td className="px-4 py-3 text-right">{row.transactions}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">₱{formatPHP(row.revenue)}</td>
                  <td className="px-4 py-3 text-right text-red-500">₱{formatPHP(row.discount)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">₱{formatPHP(row.avgTransaction)}</td>
                </tr>
              ))}
              {cashierData.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No sales data in this period</td></tr>
              )}
            </tbody>
            {cashierData.length > 0 && (
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right font-semibold">{cashierData.reduce((s, r) => s + r.transactions, 0)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">₱{formatPHP(cashierData.reduce((s, r) => s + r.revenue, 0))}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-500">₱{formatPHP(cashierData.reduce((s, r) => s + r.discount, 0))}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Inventory Movements Tab */}
      {!loading && tab === 'inventory' && (
        <div>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3 text-right">Prev</th>
                  <th className="px-4 py-3 text-right">New Qty</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m: any) => {
                  const qty = Number(m.quantity);
                  return (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(m.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2 font-medium">{m.product?.name}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${MOVEMENT_TYPE_COLORS[m.type] || 'bg-gray-100 text-gray-600'}`}>
                          {m.type}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${qty >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {qty >= 0 ? '+' : ''}{qty}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">{Number(m.previousQty)}</td>
                      <td className="px-4 py-2 text-right font-medium">{Number(m.newQty)}</td>
                      <td className="px-4 py-2 text-gray-500">{m.reason || '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{m.userName || '—'}</td>
                    </tr>
                  );
                })}
                {movements.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No movements in this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {movementsTotal > 50 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{movementsTotal} total records</span>
              <div className="flex gap-2">
                <button disabled={movPage <= 1} onClick={() => setMovPage(p => p - 1)}
                  className="px-3 py-1.5 border rounded disabled:opacity-40">Prev</button>
                <span className="px-3 py-1.5">Page {movPage}</span>
                <button disabled={movPage * 50 >= movementsTotal} onClick={() => setMovPage(p => p + 1)}
                  className="px-3 py-1.5 border rounded disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Return Modal */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
               style={{ boxShadow: '0 25px 60px -12px rgba(15,23,42,0.35)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
              <div>
                <h3 className="font-semibold text-gray-900">Return Items</h3>
                <p className="text-xs text-gray-500 mt-0.5">Receipt {returnModal.sale.receiptNumber}</p>
              </div>
              <button onClick={() => setReturnModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 text-xl">×</button>
            </div>

            {/* Items */}
            <div className="px-6 py-4 space-y-3 max-h-72 overflow-y-auto">
              {returnModal.sale.items?.map((item: any) => {
                const alreadyReturned = returnModal.sale.returns
                  ?.flatMap((r: any) => r.items || [])
                  .filter((ri: any) => ri.saleItemId === item.id)
                  .reduce((s: number, ri: any) => s + Number(ri.quantity), 0) || 0;
                const available = Number(item.quantity) - alreadyReturned;

                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.product?.name}</p>
                      <p className="text-xs text-gray-400">
                        Original: {Number(item.quantity)} {item.unitName}
                        {alreadyReturned > 0 && ` · Returned: ${alreadyReturned}`}
                        {' · '}Available: {available}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Qty:</span>
                      <input
                        type="number"
                        min={0}
                        max={available}
                        step="any"
                        value={returnQtys[item.id] || ''}
                        onChange={e => setReturnQtys(q => ({ ...q, [item.id]: parseFloat(e.target.value) || 0 }))}
                        disabled={available <= 0}
                        className="w-20 border rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="0"
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right">
                      ₱{formatPHP(returnQtys[item.id] > 0 ? (returnQtys[item.id] / Number(item.quantity)) * Number(item.total) : 0)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Reason + Summary */}
            <div className="px-6 pb-4 space-y-3">
              <input
                type="text"
                placeholder="Reason for return (optional)"
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="flex justify-between items-center bg-orange-50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-orange-800">Refund Amount</span>
                <span className="text-lg font-bold text-orange-700">₱{formatPHP(returnRefundTotal)}</span>
              </div>
              {returnError && <p className="text-red-500 text-xs">{returnError}</p>}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setReturnModal(null)}
                className="flex-1 py-2.5 border-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleReturn}
                disabled={returning || returnRefundTotal <= 0}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold text-sm transition-colors"
              >
                {returning ? 'Processing...' : `Issue Refund ₱${formatPHP(returnRefundTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

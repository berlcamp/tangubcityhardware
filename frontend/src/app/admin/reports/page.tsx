'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

const today = new Date().toISOString().split('T')[0];
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

type Tab = 'sales' | 'products' | 'inventory';

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
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (tab === 'sales') loadSalesData();
    else if (tab === 'products') loadProductsData();
    else loadInventoryData();
  }, [tab, from, to, loadSalesData, loadProductsData, loadInventoryData]);

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
        {[['sales', 'Sales'], ['products', 'Top Products'], ['inventory', 'Inventory Movements']].map(([key, label]) => (
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
    </div>
  );
}

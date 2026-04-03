'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

export default function AdminDashboard() {
  const user = auth.getUser();
  const [summary, setSummary] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [salesByDay, setSalesByDay] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.sales.todaySummary().then(setSummary).catch(() => {}),
      api.inventory.getLowStock().then(setLowStock).catch(() => {}),
      api.reports.salesByDay(7).then(setSalesByDay).catch(() => {}),
      api.reports.topProducts(5).then(setTopProducts).catch(() => {}),
      api.reports.paymentBreakdown().then(setPaymentBreakdown).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const formatPHP = (v: number) =>
    v.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <p className="text-gray-500 text-sm">Welcome back, {user?.name}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Today&apos;s Transactions</div>
          <div className="text-3xl font-bold text-blue-700">{summary?.totalSales ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-1">sales today</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Today&apos;s Revenue</div>
          <div className="text-3xl font-bold text-green-600">
            ₱{summary ? formatPHP(Number(summary.totalRevenue)) : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">gross sales</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Today&apos;s Profit</div>
          <div className={`text-3xl font-bold ${summary && Number(summary.totalProfit) >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
            {summary ? `₱${formatPHP(Number(summary.totalProfit))}` : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">gross profit</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Low Stock Items</div>
          <div className={`text-3xl font-bold ${lowStock.length > 0 ? 'text-red-500' : 'text-gray-700'}`}>
            {lowStock.length}
          </div>
          <div className="text-xs text-gray-400 mt-1">need restocking</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Revenue Line Chart */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm">Revenue — Last 7 Days</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₱${formatPHP(v)}`} />
                <Tooltip formatter={(v: any) => [`₱${formatPHP(Number(v))}`, 'Revenue']} labelFormatter={(l) => `Date: ${l}`} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Products Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm">Top 5 Products (Revenue)</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : topProducts.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₱${formatPHP(v)}`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: any) => [`₱${formatPHP(Number(v))}`, 'Revenue']} />
                <Bar dataKey="totalRevenue" fill="#16a34a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Payment Breakdown Pie */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm">Payment Methods</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : paymentBreakdown.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={paymentBreakdown}
                  dataKey="count"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {paymentBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, name: any, props: any) => [v, props.payload.method]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">Low Stock Alert</h3>
          {lowStock.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-green-500 text-sm">All stock levels are OK</div>
          ) : (
            <div className="overflow-auto max-h-48">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-right">Stock</th>
                    <th className="pb-2 text-right">Min</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((item: any) => (
                    <tr key={item.product_id || item.productId} className="border-b last:border-0">
                      <td className="py-1.5">{item.product?.name || item.name}</td>
                      <td className="py-1.5 text-right text-red-500 font-medium">{Number(item.quantity)}</td>
                      <td className="py-1.5 text-right text-gray-400">{Number(item.low_stock || item.lowStock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

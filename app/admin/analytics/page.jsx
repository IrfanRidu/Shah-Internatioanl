'use client';
import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, ScatterChart, Scatter } from 'recharts';
import Loader from '@/components/ui/Loader';
import { format } from 'date-fns';
import { Download, TrendingUp, DollarSign, Users, ShoppingCart, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#2d6a4f', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function KPICard({ title, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <p className="text-xs font-semibold text-gray-500 uppercase">{title}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState(null);
  const [advanced, setAdvanced] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    const [mr, ar] = await Promise.all([fetch(`/api/admin/metrics?${p}`), fetch(`/api/admin/analytics/advanced?${p}`)]);
    const [md, ad] = await Promise.all([mr.json(), ar.json()]);
    if (md.success === false) toast.error(md.message || 'Failed to load analytics');
    setMetrics(md.metrics);
    setAdvanced(ad);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refresh instantly when an order is marked delivered/returned/etc from the
  // Orders page — previously only the Dashboard listened for this event, so
  // the Analytics page could show stale numbers until a manual reload.
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('order-status-changed', handler);
    return () => window.removeEventListener('order-status-changed', handler);
  }, [fetchAll]);

  const exportExcel = () => window.open(`/api/admin/orders/export?format=xlsx&from=${dateRange.from}&to=${dateRange.to}`, '_blank');

  const fmt = n => `৳${(n || 0).toLocaleString()}`;
  const statusData = metrics?.statusBreakdown?.map((s, i) => ({ name: s._id, value: s.count, fill: COLORS[i % COLORS.length] })) || [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500">Financial & operational overview</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2" />
          <span className="text-gray-400 text-sm">→</span>
          <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2" />
          <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}><RefreshCw className="w-4 h-4" /> Apply</button>
          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"><Download className="w-4 h-4" /> Export Excel</button>
        </div>
      </div>

      {loading ? <Loader text="Loading analytics..." /> : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPICard title="Gross Revenue" value={fmt(metrics?.grossRevenue)} sub="All orders" icon={DollarSign} color="#2d6a4f" />
            <KPICard title="Net Profit" value={fmt(metrics?.netProfit)} sub="After COGS" icon={TrendingUp} color="#3b82f6" />
            <KPICard title="Avg Order Value" value={fmt(metrics?.aov)} sub={`${metrics?.orderCount} orders`} icon={ShoppingCart} color="#f59e0b" />
            <KPICard title="Total Customers" value={metrics?.totalUsers?.toLocaleString() || 0} sub={`Local: ${metrics?.localUsers} · Int'l: ${metrics?.intlUsers}`} icon={Users} color="#8b5cf6" />
          </div>

          {/* Revenue trend + Buyer type */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            <div className="xl:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={metrics?.dailyRevenue || []}>
                  <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.3} /><stop offset="95%" stopColor="#2d6a4f" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [`৳${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#2d6a4f" fill="url(#rg)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Orders by Status</h3>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data</div>}
            </div>
          </div>

          {/* Customer growth */}
          {advanced?.dailyGrowth?.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mb-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Customer Growth</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={advanced.dailyGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="local" name="Local Buyers" fill="#2d6a4f" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="international" name="Int'l Buyers" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top customers + Repeat stats */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Top Customers</h3>
              <div className="space-y-3">
                {(advanced?.topCustomers || []).slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.orderCount} orders · {c.buyerType}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-brand">{fmt(c.totalSpend)}</p>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-xs text-gray-400 hover:text-green-600 transition-colors">📞</a>
                      )}
                    </div>
                  </div>
                ))}
                {!advanced?.topCustomers?.length && <p className="text-gray-400 text-sm text-center py-6">No data yet</p>}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Customer Retention</h3>
              {advanced?.repeatCustomers && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-green-700 dark:text-green-400">{advanced.repeatCustomers.repeat}</p>
                      <p className="text-xs text-green-600 mt-1">Repeat Customers</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{advanced.repeatCustomers.oneTime}</p>
                      <p className="text-xs text-blue-600 mt-1">One-time Customers</p>
                    </div>
                  </div>
                  {(advanced.repeatCustomers.repeat + advanced.repeatCustomers.oneTime) > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Retention Rate</p>
                      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round(advanced.repeatCustomers.repeat / (advanced.repeatCustomers.repeat + advanced.repeatCustomers.oneTime) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{Math.round(advanced.repeatCustomers.repeat / (advanced.repeatCustomers.repeat + advanced.repeatCustomers.oneTime) * 100)}% retention</p>
                    </div>
                  )}
                </>
              )}
              <div className="mt-5 border-t border-gray-100 dark:border-gray-800 pt-5">
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Revenue by Buyer Type</h4>
                {(advanced?.revenueByType || []).map(r => (
                  <div key={r._id} className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{r._id === 'local' ? '🇧🇩 Local' : '🌍 International'}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-800 dark:text-white">{fmt(r.revenue)}</span>
                      <span className="text-xs text-gray-400 ml-2">{r.orders} orders</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top products */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Top Selling Products</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800">{['#', 'Product', 'Units Sold', 'Revenue'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody>
                  {(metrics?.topProducts || []).map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-3 py-3 text-gray-400 font-bold">#{i + 1}</td>
                      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                      <td className="px-3 py-3 text-gray-500">{p.sold} units</td>
                      <td className="px-3 py-3 font-bold text-brand">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                  {(!metrics?.topProducts?.length) && <tr><td colSpan={4} className="text-center py-8 text-gray-400">No sales data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

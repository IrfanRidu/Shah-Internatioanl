'use client';
import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, TrendingDown, ShoppingCart, Users, Package, DollarSign, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import Loader from '@/components/ui/Loader';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';
import { useOrderStream } from '@/hooks/useOrderStream';
import toast from 'react-hot-toast';

function MetricCard({ title, value, subtitle, icon: Icon, trend, color = 'green' }) {
  const colors = { green: 'text-green-600 bg-green-100', blue: 'text-blue-600 bg-blue-100', amber: 'text-amber-600 bg-amber-100', red: 'text-red-600 bg-red-100', purple: 'text-purple-600 bg-purple-100' };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}><Icon className="w-5 h-5" /></div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

const STATUS_COLORS = { pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6', onTheWay: '#06b6d4', delivered: '#22c55e', cancelled: '#ef4444', returned: '#f97316' };

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [currency, setCurrency] = useState('BDT');
  const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR'];

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ currency });
    if (dateRange.from) params.set('from', dateRange.from);
    if (dateRange.to) params.set('to', dateRange.to);
    const [metricsRes, ordersRes] = await Promise.all([
      fetch(`/api/admin/metrics?${params}`),
      fetch('/api/orders?limit=8&sort=-createdAt'),
    ]);
    const [md, od] = await Promise.all([metricsRes.json(), ordersRes.json()]);
    setMetrics(md.metrics);
    setOrders(od.orders || []);
    setLastRefresh(new Date());
    setLoading(false);
  }, [dateRange, currency]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Refresh metrics instantly when an admin marks an order as delivered/returned on the Orders page
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('order-status-changed', handler);
    return () => window.removeEventListener('order-status-changed', handler);
  }, [fetchData]);

  // Live order updates: instant push via SSE/MongoDB change streams when available,
  // automatically falling back to 30s polling if the database doesn't support them.
  const { live } = useOrderStream({
    onNewOrder: (order) => {
      toast.success(`🛎️ New order #${order.orderNumber} — ৳${order.total?.toLocaleString()}`);
      fetchData();
    },
    onPoll: fetchData,
    pollInterval: 30000,
  });

  if (loading) return <div className="py-20"><Loader text="Loading dashboard..." /></div>;

  const fmt = (n) => typeof n === 'number' ? `৳${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '৳0';
  const statusData = metrics?.statusBreakdown?.map(s => ({ name: s._id, value: s.count })) || [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500">Last updated: {format(lastRefresh, 'hh:mm:ss a')}</p>
            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${live ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {live ? 'Live' : 'Polling (30s)'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">Currency:</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-300 dark:text-white font-semibold">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">From:</label>
            <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-300" />
            <label className="text-gray-500">To:</label>
            <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-300" />
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ backgroundColor: 'var(--color-primary)' }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Alert: orders awaiting confirmation. The metrics API returns `processingOrders` — this used
          to read `metrics.pendingOrders`, a field that never existed in the response, so the banner
          could never show regardless of how many orders needed attention. */}
      {metrics?.processingOrders > 0 && (
        <Link href="/admin/orders?status=processing" className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 hover:bg-amber-100 transition-colors">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">{metrics.processingOrders} order{metrics.processingOrders > 1 ? 's' : ''} waiting for confirmation</p>
          <span className="ml-auto text-amber-600 text-sm font-medium">View →</span>
        </Link>
      )}

      {/* New orders badge */}
      {metrics?.newOrders > 0 && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-6">
          <Clock className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700 font-medium">{metrics.newOrders} new order{metrics.newOrders > 1 ? 's' : ''} in the last 24 hours!</p>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <MetricCard title="Gross Revenue" value={fmt(metrics?.grossRevenue)} icon={DollarSign} color="green" />
        <MetricCard title="Net Revenue" value={fmt(metrics?.netRevenue)} subtitle="Delivered orders" icon={TrendingUp} color="blue" />
        <MetricCard title="Gross Profit" value={fmt(metrics?.grossProfit)} subtitle="After COGS" icon={TrendingUp} color="purple" />
        <MetricCard title="Avg Order Value" value={fmt(metrics?.aov)} icon={ShoppingCart} color="amber" />
        <MetricCard title="Total Discounts" value={fmt(metrics?.totalDiscounts)} icon={Package} color="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total Orders" value={metrics?.orderCount?.toLocaleString() || 0} icon={ShoppingCart} color="blue" />
        <MetricCard title="Delivered" value={metrics?.deliveredCount?.toLocaleString() || 0} icon={Package} color="green" />
        <MetricCard title="Total Customers" value={metrics?.totalUsers?.toLocaleString() || 0} icon={Users} color="purple" />
        <MetricCard title="Active Products" value={metrics?.activeProducts?.toLocaleString() || 0} icon={Package} color="amber" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Revenue chart */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Revenue (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={metrics?.dailyRevenue || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="_id" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`৳${v.toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="rgba(45,106,79,0.1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order status pie */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Orders by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {statusData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] || '#ccc'} />)}
                </Pie>
                <Legend iconSize={8} formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No order data</div>}
        </div>
      </div>

      {/* Recent orders + top products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Recent Orders</h3>
            <Link href="/admin/orders" className="text-sm text-brand hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {orders.slice(0, 6).map(order => (
              <Link key={order._id} href={`/admin/orders?id=${order._id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-gray-800 dark:text-white text-sm">#{order.orderNumber}</span>
                    <Badge variant={{ pending: 'warning', confirmed: 'info', delivered: 'success', cancelled: 'danger', onTheWay: 'primary' }[order.status] || 'default'} className="text-xs">{order.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{order.user?.name} • {format(new Date(order.createdAt), 'dd MMM, hh:mm a')}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-bold text-brand text-sm">৳{order.total?.toLocaleString()}</span>
                  {order.user?.phone && (
                    <a href={`tel:${order.user.phone}`} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors" title="Call customer" onClick={e => e.stopPropagation()}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </a>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Top Products</h3>
            <Link href="/admin/products" className="text-sm text-brand hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {(metrics?.topProducts || []).slice(0, 7).map((p, i) => (
              <div key={p._id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.sold} units sold</p>
                </div>
                <span className="text-sm font-bold text-brand flex-shrink-0">৳{p.revenue?.toLocaleString()}</span>
              </div>
            ))}
            {(!metrics?.topProducts || metrics.topProducts.length === 0) && <p className="text-gray-400 text-sm text-center py-4">No sales data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

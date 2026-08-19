'use client';
import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import Loader from '@/components/ui/Loader';
import { RefreshCw, Package, DollarSign, Truck, Layers, TrendingUp, Globe2, Users } from 'lucide-react';
import toast from 'react-hot-toast';

// Batch 19 (R33-5): same visual language as app/admin/analytics/page.jsx's own KPICard/COLORS —
// this page is that established pattern applied to export data instead of storefront orders.
const COLORS = ['#2d6a4f', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

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

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
      <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mb-3">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-1'}>{children}</div>
    </div>
  );
}

const fmtUSD = (n) => `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtBDT = (n) => `৳${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtKg = (n) => `${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;

const STATUS_LABELS = { draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived' };

export default function ExportOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/export-overview');
      const d = await res.json();
      if (!d.success) { toast.error(d.message || 'Failed to load export overview'); return; }
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) return <Loader />;
  if (!data) return null;

  const { kpis, trend, countryBreakdown, categoryBreakdown, topBuyers, statusBreakdown, incentives } = data;
  const statusData = Object.entries(statusBreakdown || {}).map(([key, value], i) => ({ name: STATUS_LABELS[key] || key, value, fill: COLORS[i % COLORS.length] }));
  const incentiveStatusData = Object.entries(incentives?.byStatus || {}).map(([key, value], i) => ({ name: key === 'claimed' ? 'Claimed' : 'In Documentation', value, fill: key === 'claimed' ? '#2d6a4f' : '#f59e0b' }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Export Overview</h1>
          <p className="text-sm text-gray-500">KPIs and trends across every country, buyer, and category</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Shipments" value={kpis.totalShipments.toLocaleString()} icon={Package} color={COLORS[0]} />
        <KPICard title="Total Export Value" value={fmtUSD(kpis.totalValueUSD)} sub="Normalized to USD" icon={DollarSign} color={COLORS[1]} />
        <KPICard title="Total Weight Shipped" value={fmtKg(kpis.totalWeightKg)} icon={Truck} color={COLORS[2]} />
        <KPICard title="Total Cartons" value={kpis.totalCTN.toLocaleString()} icon={Layers} color={COLORS[3]} />
        <KPICard title="Avg. Shipment Value" value={fmtUSD(kpis.avgShipmentValueUSD)} icon={TrendingUp} color={COLORS[4]} />
        <KPICard title="Countries Served" value={kpis.totalCountries.toLocaleString()} icon={Globe2} color={COLORS[5]} />
        <KPICard title="Active Buyers" value={kpis.totalBuyers.toLocaleString()} icon={Users} color={COLORS[6]} />
        <KPICard title="Incentive Receivable" value={fmtBDT(incentives.totalBDT)} sub={`${incentives.applicationCount} application${incentives.applicationCount === 1 ? '' : 's'}`} icon={DollarSign} color={COLORS[7]} />
      </div>

      {/* Export volume & value trend (last 12 months) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Export Value Trend" subtitle="Last 12 months, normalized to USD">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmtUSD(v)} />
              <Area type="monotone" dataKey="valueUSD" name="Export Value" stroke={COLORS[1]} fill="url(#valueGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Shipment Volume Trend" subtitle="Number of shipments per month">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="shipments" name="Shipments" fill={COLORS[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Country/market & product/category performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Top Markets by Value" subtitle="Top 10 destination countries, USD">
          {countryBreakdown.length === 0 ? <p className="text-sm text-gray-400 py-10 text-center">No shipment data yet</p> : (
            <ResponsiveContainer width="100%" height={Math.max(220, countryBreakdown.length * 34)}>
              <BarChart data={countryBreakdown} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                <XAxis type="number" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" fontSize={11} width={90} />
                <Tooltip formatter={(v) => fmtUSD(v)} />
                <Bar dataKey="valueUSD" name="Export Value" fill={COLORS[1]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Category Performance" subtitle="Every export category, by value">
          {categoryBreakdown.length === 0 ? <p className="text-sm text-gray-400 py-10 text-center">No shipment data yet</p> : (
            <ResponsiveContainer width="100%" height={Math.max(220, categoryBreakdown.length * 34)}>
              <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                <XAxis type="number" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                <Tooltip formatter={(v) => fmtUSD(v)} />
                <Bar dataKey="valueUSD" name="Export Value" fill={COLORS[4]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Top buyers, shipment status, incentive overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Top Buyers" subtitle="By export value, USD">
          {topBuyers.length === 0 ? <p className="text-sm text-gray-400 py-10 text-center">No shipment data yet</p> : (
            <div className="space-y-2.5">
              {topBuyers.map((b, i) => (
                <div key={b.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}>{i + 1}</span>
                    <span className="truncate text-gray-700 dark:text-gray-300">{b.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0">{fmtUSD(b.valueUSD)}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
        <ChartCard title="Shipment Status">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Incentive Overview" subtitle="Estimated, BDT — see Export Incentives for exact per-application figures">
          <div className="space-y-3 mt-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total Receivable</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmtBDT(incentives.totalBDT)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Claimed</span>
              <span className="font-semibold text-green-600">{fmtBDT(incentives.claimedBDT)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Pending</span>
              <span className="font-semibold text-amber-600">{fmtBDT(incentives.pendingBDT)}</span>
            </div>
            {incentiveStatusData.length > 0 && (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={incentiveStatusData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} paddingAngle={2}>
                    {incentiveStatusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { ArrowLeft, Download, TrendingUp, Wallet, Trash2, Edit2, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Loader from '@/components/ui/Loader';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// Issue 46: money is always shown with exactly two decimal places.
const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CURRENCY_SYMBOLS = { BDT: '৳', USD: '$', EUR: '€', GBP: '£', INR: '₹', PKR: '₨', AED: 'د.إ', SAR: 'ر.س', JPY: '¥', CAD: 'C$', AUD: 'A$' };
const symbolFor = (cur) => CURRENCY_SYMBOLS[cur] || cur || '';

export default function ExportAnalyticsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [countryFilter, setCountryFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [countries, setCountries] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  // Issue 46/47: Initial Balance (principal) + base currency, persisted server-side and used as the
  // default for every future calculation until the admin changes them again.
  const [initialBalance, setInitialBalance] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState('BDT');
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetch('/api/export/countries').then(r => r.json()).then(d => setCountries(d.countries || []));
    fetch('/api/export/buyers').then(r => r.json()).then(d => setBuyers(d.buyers || []));
  }, []);

  const fetchAnalytics = async (currencyOverride) => {
    setLoading(true);
    const q = new URLSearchParams({ year });
    if (countryFilter) q.set('country', countryFilter);
    if (buyerFilter) q.set('buyer', buyerFilter);
    if (currencyOverride) q.set('baseCurrency', currencyOverride);
    const r = await fetch(`/api/export/analytics?${q}`);
    const d = await r.json();
    setRows(d.rows || []);
    setTotals(d.totals || {});
    setInitialBalance(d.initialBalance || 0);
    setBaseCurrency(d.baseCurrency || 'BDT');
    setLoading(false);
  };

  useEffect(() => { fetchAnalytics(); }, [year, countryFilter, buyerFilter]);

  // Issue 46: numeric validation — no negative principal allowed.
  const saveInitialBalance = async () => {
    const val = Number(balanceDraft);
    if (!Number.isFinite(val) || val < 0) { toast.error('Initial Balance must be a non-negative number'); return; }
    setSavingSettings(true);
    const r = await fetch('/api/export/analytics', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initialBalance: val }) });
    const d = await r.json();
    setSavingSettings(false);
    if (d.success) { toast.success('Initial Balance updated'); setEditingBalance(false); fetchAnalytics(); }
    else toast.error(d.message || 'Failed to update');
  };

  // Issue 47: admin-selectable base currency for this dashboard specifically.
  const changeBaseCurrency = async (cur) => {
    setBaseCurrency(cur);
    setSavingSettings(true);
    const r = await fetch('/api/export/analytics', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseCurrency: cur }) });
    const d = await r.json();
    setSavingSettings(false);
    if (d.success) fetchAnalytics(cur);
    else toast.error(d.message || 'Failed to update currency');
  };

  // Issue 45: rows are demo/real shipments — deletion now goes through the audit log + recycle bin
  // (soft delete) instead of being blocked or permanently destructive.
  const deleteRow = async (row) => {
    if (!confirm(`Delete this shipment row (${row.company}, ${row.month})? It will be moved to the Recycle Bin and can be restored later.`)) return;
    setDeletingId(row._id);
    const r = await fetch(`/api/export/shipments/${row._id}`, { method: 'DELETE' });
    const d = await r.json();
    setDeletingId(null);
    if (d.success) { toast.success('Moved to Recycle Bin — restorable from Export Dashboard → Audit Log'); fetchAnalytics(); }
    else toast.error(d.message || 'Failed to delete');
  };

  const exportXLSX = () => {
    const headers = ['Month', 'Company', 'Date', 'Total Net Weight (kg)', 'Total Gross Weight (kg)', `Freight Cost (${baseCurrency})`, `Goods Cost (${baseCurrency})`, `Export Processing Cost (${baseCurrency})`, `Others Cost/Logistics/Labour (${baseCurrency})`, `Damage (${baseCurrency})`, `Total Cost (${baseCurrency})`, `Order Value`, 'Rate in BDT', `Receive Amount (${baseCurrency})`, `Available Balance (${baseCurrency})`, `Shipment Margin (${baseCurrency})`, `Incentive (${baseCurrency})`, `Net Profit (${baseCurrency})`];
    const data = rows.map(r => [r.month, r.company, r.date ? new Date(r.date).toLocaleDateString() : '', r.totalNetWeightKg, r.totalGrossWeightKg, r.freightCost, r.goodsCost, r.exportProcessingCost, r.othersCost, r.damage, r.totalCost, `${r.orderValueForeign} ${r.orderCurrency}`, r.exchangeRateBDT, r.receiveAmountBDT, r.availableBalance, r.shipmentMargin, r.incentive, r.netProfit]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, `Export History ${year}`);
    XLSX.writeFile(wb, `export-analytics-${year}.xlsx`);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const sym = symbolFor(baseCurrency);

  // Issue 46: Shipment Margin coloring — neon green positive, light red negative, default at zero.
  const marginColor = (v) => (v > 0 ? '#39ff14' : v < 0 ? '#f87171' : undefined);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push('/admin/export-dashboard')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand" /> Export Analytics {year}
          </h1>
          <p className="text-sm text-gray-500">Full business analysis — all figures in {baseCurrency} unless noted</p>
        </div>
        <button onClick={exportXLSX} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Download className="w-4 h-4" /> Export XLSX
        </button>
      </div>

      {/* Filters + base currency selector (issue 47) */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field py-2 text-sm w-auto">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setBuyerFilter(''); }} className="input-field py-2 text-sm w-auto">
          <option value="">All Countries</option>
          {countries.map(c => <option key={c._id} value={c._id}>{c.flag || ''} {c.name}</option>)}
        </select>
        <select value={buyerFilter} onChange={e => setBuyerFilter(e.target.value)} className="input-field py-2 text-sm w-auto">
          <option value="">All Companies</option>
          {buyers.filter(b => !countryFilter || b.country?._id === countryFilter).map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500 font-medium">Base Currency:</span>
          <select value={baseCurrency} onChange={e => changeBaseCurrency(e.target.value)} disabled={savingSettings} className="input-field py-2 text-sm w-auto font-semibold">
            {['BDT', 'USD', 'EUR', 'GBP', 'INR', 'PKR', 'AED', 'SAR', 'JPY', 'CAD', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Issue 46: Initial Balance summary card, above the Export History table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-brand/20 p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5 text-brand" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Initial Balance (Principal)</p>
            {editingBalance ? (
              <div className="flex items-center gap-2">
                <input type="number" min="0" autoFocus value={balanceDraft} onChange={e => setBalanceDraft(e.target.value)} className="input-field py-1.5 text-lg font-bold w-40" />
                <span className="text-sm text-gray-400">BDT</span>
                <button onClick={saveInitialBalance} disabled={savingSettings} className="p-1.5 rounded-lg bg-brand text-white hover:opacity-90"><Save className="w-4 h-4" /></button>
                <button onClick={() => setEditingBalance(false)} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xl font-black text-gray-900 dark:text-white">৳{money(initialBalance)}</p>
                <button onClick={() => { setBalanceDraft(String(initialBalance)); setEditingBalance(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand transition-colors" title="Edit Initial Balance">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 max-w-xs text-right">Used as the default principal for every shipment's Available Balance / Shipment Margin / Net Profit calculation until changed here.</p>
      </div>

      {loading ? <Loader /> : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Net Profit', value: `${sym}${money(totals.netProfit)}`, color: 'text-green-600' },
              { label: 'Total Receive Amount', value: `${sym}${money(totals.receiveAmountBDT)}`, color: 'text-blue-600' },
              { label: 'Total Cost', value: `${sym}${money(totals.totalCost)}`, color: 'text-red-500' },
              { label: 'Incentive', value: `${sym}${money(totals.incentive)}`, color: 'text-purple-600' },
            ].map(card => (
              <div key={card.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* The analytics table — issue 46 column order: Month>Company>Date>Net Weight>Gross Weight
              >(costs side by side)>(capital gain side by side). Horizontally scrollable + responsive. */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-4 text-center font-black text-lg border-b" style={{ backgroundColor: '#1a1a2e', color: 'white' }}>
              Export History {year}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {[
                      { label: 'Month', bg: '#2d2d2d' },
                      { label: 'Company', bg: '#2d2d2d' },
                      { label: 'Date', bg: '#2d2d2d' },
                      { label: 'Total Net Weight', bg: '#1d4ed8' },
                      { label: 'Total Gross Weight', bg: '#1d4ed8' },
                      { label: `Freight Cost (${baseCurrency})`, bg: '#b45309' },
                      { label: `Goods Cost (${baseCurrency})`, bg: '#b45309' },
                      { label: `Export Processing Cost (${baseCurrency})`, bg: '#b45309' },
                      { label: `Others Cost/Logistics/Labour (${baseCurrency})`, bg: '#b45309' },
                      { label: `Damage (${baseCurrency})`, bg: '#b45309' },
                      { label: `Total Cost (${baseCurrency})`, bg: '#7c2d12' },
                      { label: 'Order Value', bg: '#f97316' },
                      { label: 'Rate in BDT', bg: '#f97316' },
                      { label: `Receive Amount (${baseCurrency})`, bg: '#f97316' },
                      { label: `Available Balance (${baseCurrency})`, bg: '#115e59' },
                      { label: `Shipment Margin (${baseCurrency})`, bg: '#115e59' },
                      { label: `Incentive (${baseCurrency})`, bg: '#16a34a' },
                      { label: `Net Profit (${baseCurrency})`, bg: '#16a34a' },
                      { label: '', bg: '#2d2d2d' },
                    ].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-left font-semibold text-white whitespace-nowrap text-[11px]" style={{ backgroundColor: h.bg }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row._id || i} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}>
                      <td className="px-3 py-2.5 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.month}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.company}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.date ? new Date(row.date).toLocaleDateString('en-GB') : '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{money(row.totalNetWeightKg)} kg</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{money(row.totalGrossWeightKg)} kg</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{sym}{money(row.freightCost)}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{sym}{money(row.goodsCost)}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{sym}{money(row.exportProcessingCost)}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{sym}{money(row.othersCost)}</td>
                      <td className="px-3 py-2.5 text-red-500 whitespace-nowrap">{sym}{money(row.damage)}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{sym}{money(row.totalCost)}</td>
                      <td className="px-3 py-2.5 font-bold text-orange-600 whitespace-nowrap">{symbolFor(row.orderCurrency)}{money(row.orderValueForeign)} {row.orderCurrency}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{money(row.exchangeRateBDT)}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{sym}{money(row.receiveAmountBDT)}</td>
                      {/* Issue 46: highlight calculated fields for readability */}
                      <td className="px-3 py-2.5 font-bold whitespace-nowrap bg-blue-50/60 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400">{sym}{money(row.availableBalance)}</td>
                      <td className="px-3 py-2.5 font-bold whitespace-nowrap bg-blue-50/60 dark:bg-blue-900/10" style={{ color: marginColor(row.shipmentMargin) }}>{sym}{money(row.shipmentMargin)}</td>
                      <td className="px-3 py-2.5 text-purple-600 font-semibold whitespace-nowrap">{sym}{money(row.incentive)}</td>
                      <td className="px-3 py-2.5 font-bold whitespace-nowrap bg-emerald-50/60 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400">{sym}{money(row.netProfit)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {/* Issue 45: rows (including demo/seed data) can now be deleted — soft delete via recycle bin */}
                        <button onClick={() => deleteRow(row)} disabled={deletingId === row._id} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40" title="Delete row (recoverable from Recycle Bin)">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {rows.length > 0 && (
                    <tr className="font-black text-white" style={{ backgroundColor: '#1a1a2e' }}>
                      <td colSpan={3} className="px-3 py-3 text-right">TOTALS:</td>
                      <td className="px-3 py-3">{money(totals.totalNetWeightKg)} kg</td>
                      <td className="px-3 py-3">{money(totals.totalGrossWeightKg)} kg</td>
                      <td className="px-3 py-3">{sym}{money(totals.freightCost)}</td>
                      <td className="px-3 py-3">{sym}{money(totals.goodsCost)}</td>
                      <td className="px-3 py-3">{sym}{money(totals.exportProcessingCost)}</td>
                      <td className="px-3 py-3">{sym}{money(totals.othersCost)}</td>
                      <td className="px-3 py-3 text-red-400">{sym}{money(totals.damage)}</td>
                      <td className="px-3 py-3">{sym}{money(totals.totalCost)}</td>
                      <td className="px-3 py-3">—</td>
                      <td className="px-3 py-3">—</td>
                      <td className="px-3 py-3">{sym}{money(totals.receiveAmountBDT)}</td>
                      <td className="px-3 py-3 text-blue-300">{sym}{money(totals.availableBalance)}</td>
                      <td className="px-3 py-3" style={{ color: marginColor(totals.shipmentMargin) || '#93c5fd' }}>{sym}{money(totals.shipmentMargin)}</td>
                      <td className="px-3 py-3 text-purple-400">{sym}{money(totals.incentive)}</td>
                      <td className="px-3 py-3 text-emerald-300">{sym}{money(totals.netProfit)}</td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  )}
                </tbody>
              </table>
              {rows.length === 0 && <div className="py-16 text-center text-gray-400">No shipments found for {year}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

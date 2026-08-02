'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings as SettingsIcon, ArrowLeft, Tag, ArrowRight } from 'lucide-react';
import CtnConfigSection from '@/components/admin/export-settings/CtnConfigSection';
import ShipmentOptionsSection from '@/components/admin/export-settings/ShipmentOptionsSection';
import BankAccountSection from '@/components/admin/export-settings/BankAccountSection';
import ExportLicenseSection from '@/components/admin/export-settings/ExportLicenseSection';

// Requirement order mirrors the spec's own numbering (2, 5, 6, 7) rather than an arbitrary
// order, so an admin working through the source document top-to-bottom finds each section where
// they'd expect it. Export Categories (requirement 8) moved out to its own first-class page — see
// the callout below — since batch 7 made it the export dashboard's central concept (it now also
// owns each category's document-format configuration, a bigger role than a "settings tab" fits).
const SECTIONS = [
  { id: 'ctn', label: '📦 CTN Configuration' },
  { id: 'shipment', label: '🚢 Shipment Configuration' },
  { id: 'bank', label: '🏦 Bank Accounts' },
  { id: 'license', label: '📜 Export Licenses' },
];

export default function ExportSettingsPage() {
  // The tab used to always reset to CTN Configuration on every refresh, which was reported as
  // confusing (especially when trying to verify a save on a different tab). Persisted in the URL
  // via plain history.replaceState — deliberately not next/navigation's router+useSearchParams,
  // which would require wrapping this page in a Suspense boundary just for a simple "remember which
  // tab was open" need.
  const [tab, setTab] = useState('ctn');
  const [currency, setCurrency] = useState('BDT');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && SECTIONS.some(s => s.id === fromUrl)) setTab(fromUrl);
  }, []);

  const changeTab = (id) => {
    setTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState({}, '', url);
  };

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => setCurrency(d?.settings?.defaultCurrency || 'BDT')).catch(() => {});
    // Export License's "License Type" dropdown needs the category list — fetched once here rather
    // than duplicating this fetch inside that section too.
    fetch('/api/export/categories').then(r => r.json()).then(d => setCategories(d.items || [])).catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/export-dashboard" className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-brand" /> Export Dashboard Settings
          </h1>
          <p className="text-sm text-gray-500">Configure CTN sizes, shipment options, bank accounts, and export licenses</p>
        </div>
      </div>

      {/* Export Categories moved to its own page — it's the dashboard's central concept now
          (defines each category's document format), not a settings tab. */}
      <Link href="/admin/export-dashboard/categories"
        className="flex items-center justify-between gap-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-900 p-4 mb-6 hover:shadow-md transition-all group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center flex-shrink-0"><Tag className="w-5 h-5 text-brand" /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Looking for Export Categories?</p>
            <p className="text-xs text-gray-500">Categories now have their own page — they define each shipment's packing list, invoice, and BD invoice format</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-brand flex-shrink-0 group-hover:translate-x-1 transition-transform" />
      </Link>

      <div className="flex gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-2 flex-wrap">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => changeTab(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === s.id ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            style={tab === s.id ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {s.label}
          </button>
        ))}
      </div>

      {tab === 'ctn' && <CtnConfigSection currency={currency} />}
      {tab === 'shipment' && <ShipmentOptionsSection />}
      {tab === 'bank' && <BankAccountSection />}
      {tab === 'license' && <ExportLicenseSection categories={categories} />}
    </div>
  );
}

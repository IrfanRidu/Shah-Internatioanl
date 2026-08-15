'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe2, Plus, Edit2, Trash2, BarChart3, Archive, Ship } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import toast from 'react-hot-toast';

// Country flag emoji from ISO code
const flagEmoji = (code) => {
  if (!code || code.length !== 2) return '🌍';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
};

function CountryCard({ country, onEdit, onDelete }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-4">
        <Link href={`/admin/export-dashboard/countries/${country._id}`} className="flex items-center gap-3 flex-1">
          <div className="text-5xl select-none">{country.flag || flagEmoji(country.code)}</div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg">{country.name}</h3>
            <p className="text-sm text-gray-400">{country.code} · {country.currency}</p>
          </div>
        </Link>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(country)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(country)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <Link href={`/admin/export-dashboard/countries/${country._id}`}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
        style={{ backgroundColor: 'var(--color-primary)' }}>
        <Ship className="w-4 h-4" /> View Companies & Shipments
      </Link>
      {country.notes && <p className="text-xs text-gray-400 mt-2 truncate">{country.notes}</p>}
    </div>
  );
}

export default function ExportDashboardPage() {
  const [tab, setTab] = useState('countries');
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', flag: '', currency: 'EUR', notes: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Batch 7 (R1) — exporter name/address, previously hardcoded text scattered across the print/PDF
  // code, now a single editable source shown on every Shipment Details tab and every document.
  const [exporterInfo, setExporterInfo] = useState({ exporterName: '', exporterAddress: '' });
  const [savingExporter, setSavingExporter] = useState(false);
  const [exporterDraft, setExporterDraft] = useState(null); // non-null while the small edit form is open
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setExporterInfo({ exporterName: d?.settings?.exporterName || 'Shah International', exporterAddress: d?.settings?.exporterAddress || '' });
    }).catch(() => {});
  }, []);
  const saveExporterInfo = async () => {
    if (!exporterDraft) return;
    setSavingExporter(true);
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exporterDraft) });
    const d = await r.json();
    setSavingExporter(false);
    if (d.success) {
      setExporterInfo({ exporterName: d.settings?.exporterName || '', exporterAddress: d.settings?.exporterAddress || '' });
      setExporterDraft(null);
      toast.success('Exporter details updated — now used on every shipment document');
    } else toast.error(d.message || 'Failed to save');
  };
  const fetchCountries = async () => {
    setLoading(true);
    const r = await fetch('/api/export/countries');
    const d = await r.json();
    setCountries(d.countries || []);
    setLoading(false);
  };

  useEffect(() => { fetchCountries(); }, []);

  // Auto-fill flag emoji when country code changes
  useEffect(() => {
    if (form.code?.length === 2 && !edit) set('flag', flagEmoji(form.code));
  }, [form.code]);

  const openNew = () => { setEdit(null); setForm({ name: '', code: '', flag: '', currency: 'EUR', notes: '' }); setModal(true); };
  const openEdit = (c) => { setEdit(c); setForm({ name: c.name, code: c.code, flag: c.flag || '', currency: c.currency || 'EUR', notes: c.notes || '' }); setModal(true); };

  const handleSave = async () => {
    if (!form.name || !form.code) { toast.error('Name and country code required'); return; }
    setSaving(true);
    const url = edit ? `/api/export/countries/${edit._id}` : '/api/export/countries';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetchCountries(); }
    else toast.error(d.message);
  };

  const handleDelete = async (c) => {
    if (!confirm(`Remove ${c.name} from export dashboard? This does not delete shipment data.`)) return;
    await fetch(`/api/export/countries/${c._id}`, { method: 'DELETE' });
    fetchCountries();
    toast.success('Country removed');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-brand" /> Export Dashboard
          </h1>
          <p className="text-sm text-gray-500">Start with an Export Category, then manage countries, buyers, shipments, documents and analytics</p>
        </div>
      </div>

      <div className="mb-6">
        {/* Batch 7 (R1) — exporter name/address, shown on every Shipment Details tab & document.
            Batch 17 (R7): this used to sit in a 2-column grid next to a global "Company
            Letterhead" upload card — that card is removed (letterhead now comes exclusively from
            the selected Export License, see ExportLicenseSection), so this card now stands alone. */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-900 p-4 max-w-xl">
          {exporterDraft ? (
            <div className="space-y-2">
              <input value={exporterDraft.exporterName} onChange={e => setExporterDraft(p => ({ ...p, exporterName: e.target.value }))}
                placeholder="Exporter name" className="input-field py-1.5 text-sm w-full" />
              <textarea value={exporterDraft.exporterAddress} onChange={e => setExporterDraft(p => ({ ...p, exporterAddress: e.target.value }))}
                placeholder="Exporter address" rows={2} className="input-field py-1.5 text-sm w-full resize-none" />
              <div className="flex gap-2">
                <Button variant="primary" onClick={saveExporterInfo} loading={savingExporter}>Save</Button>
                <Button variant="ghost" onClick={() => setExporterDraft(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Exporter Details</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">{exporterInfo.exporterName || 'Shah International'}</p>
                <p className="text-xs text-green-600 mt-0.5">{exporterInfo.exporterAddress}</p>
              </div>
              <button onClick={() => setExporterDraft(exporterInfo)}
                className="px-4 py-2 bg-white dark:bg-gray-900 border border-green-300 rounded-xl text-sm font-medium text-green-700 hover:bg-green-50 transition-all">
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top-level nav: Export Categories comes first — it's the dashboard's central concept
          (batch 7): pick/create a category before a shipment, since it drives that shipment's
          document format. Countries stays as an in-page tab; the rest navigate directly on a
          single click. */}
      <div className="flex gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-2 flex-wrap">
        <Link href="/admin/export-dashboard/categories"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}>
          🏷️ Export Categories
        </Link>
        <button onClick={() => setTab('countries')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'countries' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
          🌍 Countries & Buyers
        </button>
        <Link href="/admin/export-dashboard/analytics"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          📊 Export Analytics
        </Link>
        <Link href="/admin/export-dashboard/archive"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          🗂️ Export Archives
        </Link>
        <Link href="/admin/export-dashboard/incentives"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          💰 Incentive
        </Link>
        <Link href="/admin/export-dashboard/settings"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          ⚙️ Settings
        </Link>
      </div>

      {/* Countries Tab */}
      {tab === 'countries' && (
        <>
          <div className="flex justify-end mb-4">
            <Button variant="primary" icon={Plus} onClick={openNew}>Add Country</Button>
          </div>
          {loading ? <Loader /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {countries.map(c => <CountryCard key={c._id} country={c} onEdit={openEdit} onDelete={handleDelete} />)}
              {countries.length === 0 && (
                <div className="col-span-3 text-center py-16 text-gray-400">
                  <Globe2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">No export countries yet</p>
                  <p className="text-sm mt-1">Add your first destination country to get started</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Country Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Country' : 'Add Export Country'}
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Country Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="France" />
            <Input label="ISO Code (2 letters)" required value={form.code} onChange={e => set('code', e.target.value.toUpperCase().slice(0, 2))} placeholder="FR" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Flag</label>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{form.flag || '🌍'}</span>
                <input value={form.flag} onChange={e => set('flag', e.target.value)} placeholder="Auto from code or paste emoji / URL" className="input-field py-2 text-sm flex-1" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Auto-filled from the ISO code above, or paste a custom emoji/URL</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Trading Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input-field">
                {['EUR', 'USD', 'GBP', 'AED', 'SAR', 'SGD', 'MYR', 'JPY', 'CAD', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field resize-none text-sm" placeholder="Optional notes about this market..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}

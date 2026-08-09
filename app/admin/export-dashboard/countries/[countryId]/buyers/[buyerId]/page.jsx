'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit2, Trash2, FileSignature, Ship, Package } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Batch 9 (R18): this page used to list the buyer's shipments directly. The route is now
// country → buyer → Export Contract → shipments — this page lists Export Contracts, and shipments
// live one level deeper at contracts/[contractId] (a new page that reuses this page's OLD
// shipment-list JSX almost verbatim — see that file's own header comment).
const emptyForm = { contractNo: '', date: format(new Date(), 'yyyy-MM-dd'), exportCategory: '', value: '', baseCurrency: 'EUR', notes: '' };

export default function BuyerContractsPage() {
  const { countryId, buyerId } = useParams();
  const router = useRouter();
  const [buyer, setBuyer] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [categories, setCategories] = useState([]);
  // Just the count of legacy (pre-batch-9) shipments with no contract set, so the fallback card can
  // be hidden entirely once an admin has finished reassigning all of them.
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchData = async () => {
    setLoading(true);
    const [br, cr, catr, ur] = await Promise.all([
      fetch(`/api/export/buyers/${buyerId}`).then(r => r.json()),
      fetch(`/api/export/contracts?buyer=${buyerId}`).then(r => r.json()),
      fetch('/api/export/categories').then(r => r.json()),
      fetch(`/api/export/shipments?buyer=${buyerId}&contract=none&limit=1`).then(r => r.json()),
    ]);
    setBuyer(br.buyer);
    setContracts(cr.contracts || []);
    setCategories((catr.items || []).filter(c => c.isActive));
    setUnassignedCount(ur.total || 0);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [buyerId]);

  const openNew = () => { setEdit(null); setForm({ ...emptyForm, baseCurrency: buyer?.currency || 'EUR' }); setModal(true); };
  const openEdit = (c) => {
    setEdit(c);
    setForm({
      contractNo: c.contractNo, date: c.date ? format(new Date(c.date), 'yyyy-MM-dd') : '',
      exportCategory: c.exportCategory?._id || '', value: c.value ?? '', baseCurrency: c.baseCurrency || 'EUR', notes: c.notes || '',
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.contractNo || !form.date) { toast.error('Contract No and Date are required'); return; }
    setSaving(true);
    const url = edit ? `/api/export/contracts/${edit._id}` : '/api/export/contracts';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, value: Number(form.value) || 0, buyer: buyerId, country: countryId }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetchData(); }
    else toast.error(d.message);
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete contract ${c.contractNo}? Shipments already under it will need to be reassigned to another contract. This cannot be undone.`)) return;
    const r = await fetch(`/api/export/contracts/${c._id}`, { method: 'DELETE' });
    const d = await r.json();
    if (d.success) { fetchData(); toast.success('Contract deleted'); } else toast.error(d.message || 'Could not delete this contract');
  };

  if (loading) return <div className="py-20"><Loader /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push(`/admin/export-dashboard/countries/${countryId}`)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{buyer?.name}</h1>
          <p className="text-sm text-gray-500">{buyer?.address} · {contracts.length} export contract{contracts.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew}>New Export Contract</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contracts.map(c => (
          <div key={c._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 group hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                  <FileSignature className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{c.contractNo}</p>
                  <p className="text-xs text-gray-400">{c.date ? format(new Date(c.date), 'dd MMM yyyy') : '—'}</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="space-y-1.5 mb-4 text-sm">
              {c.exportCategory?.name && <p className="text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-lg inline-block">{c.exportCategory.name}</p>}
              <p className="text-gray-500">Value: <span className="font-semibold text-gray-700 dark:text-gray-300">{c.baseCurrency} {(c.value || 0).toLocaleString()}</span></p>
              <p className="text-xs text-gray-400">Base currency: <span className="font-semibold text-gray-600 dark:text-gray-300">{c.baseCurrency}</span></p>
            </div>

            <Link href={`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}/contracts/${c._id}`}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}>
              <Ship className="w-4 h-4" /> View Shipments
            </Link>
          </div>
        ))}

        {/* Legacy fallback: shipments created before this entity existed. Only ever shown when such
            shipments actually remain — disappears on its own once they're all reassigned. */}
        {unassignedCount > 0 && (
          <Link href={`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}/contracts/none`}
            className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 p-5 flex flex-col items-center justify-center text-center hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
            <Package className="w-8 h-8 text-amber-500 mb-2" />
            <p className="font-semibold text-amber-700 dark:text-amber-400">Shipments without a Contract</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-500/70 mt-1">{unassignedCount} shipment{unassignedCount !== 1 ? 's' : ''} · assign one to bring them here</p>
          </Link>
        )}

        {contracts.length === 0 && unassignedCount === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No export contracts yet for {buyer?.name}</p>
            <p className="text-sm mt-1">Create one to start adding shipments under it</p>
          </div>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Export Contract' : 'New Export Contract'}
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Export Contract No" required value={form.contractNo} onChange={e => set('contractNo', e.target.value)} placeholder="SI-001/2026" />
            <Input label="Date" type="date" required value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Export Category</label>
            <select value={form.exportCategory} onChange={e => set('exportCategory', e.target.value)} className="input-field">
              <option value="">— None —</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Value" type="number" step="0.01" value={form.value} onChange={e => set('value', e.target.value)} placeholder="500000" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Base Currency</label>
              <select value={form.baseCurrency} onChange={e => set('baseCurrency', e.target.value)} className="input-field">
                {['EUR', 'USD', 'GBP', 'AED', 'SAR', 'SGD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">Shipments created under this contract default to this base currency until individually changed.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field resize-none text-sm" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

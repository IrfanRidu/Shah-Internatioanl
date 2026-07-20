'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit2, Trash2, Building2, Phone, Mail, Ship } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import toast from 'react-hot-toast';

export default function CountryDetailPage() {
  const { countryId } = useParams();
  const router = useRouter();
  const [country, setCountry] = useState(null);
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', taxId: '', currency: 'EUR', notes: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchData = async () => {
    setLoading(true);
    const [cr, br] = await Promise.all([
      fetch(`/api/export/countries`).then(r => r.json()),
      fetch(`/api/export/buyers?country=${countryId}`).then(r => r.json()),
    ]);
    const found = (cr.countries || []).find(c => c._id === countryId);
    setCountry(found || null);
    setBuyers(br.buyers || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [countryId]);

  const openNew = () => { setEdit(null); setForm({ name: '', contactPerson: '', email: '', phone: '', address: '', taxId: '', currency: country?.currency || 'EUR', notes: '' }); setModal(true); };
  const openEdit = (b) => { setEdit(b); setForm({ name: b.name, contactPerson: b.contactPerson || '', email: b.email || '', phone: b.phone || '', address: b.address || '', taxId: b.taxId || '', currency: b.currency || 'EUR', notes: b.notes || '' }); setModal(true); };

  const handleSave = async () => {
    if (!form.name) { toast.error('Company name required'); return; }
    setSaving(true);
    const url = edit ? `/api/export/buyers/${edit._id}` : '/api/export/buyers';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, country: countryId }) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetchData(); }
    else toast.error(d.message);
  };

  const handleDelete = async (b) => {
    if (!confirm(`Remove ${b.name}?`)) return;
    await fetch(`/api/export/buyers/${b._id}`, { method: 'DELETE' });
    fetchData(); toast.success('Removed');
  };

  if (loading) return <div className="py-20"><Loader /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/admin/export-dashboard')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{country?.flag || '🌍'}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{country?.name || 'Country'}</h1>
            <p className="text-sm text-gray-500">Export buyers / companies in this market</p>
          </div>
        </div>
        <div className="ml-auto">
          <Button variant="primary" icon={Plus} onClick={openNew}>Add Company</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buyers.map(b => (
          <div key={b._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 group hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{b.name}</p>
                  {b.contactPerson && <p className="text-xs text-gray-400">{b.contactPerson}</p>}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="space-y-1.5 mb-4 text-sm">
              {b.email && <div className="flex items-center gap-2 text-gray-500"><Mail className="w-3.5 h-3.5 flex-shrink-0" /><a href={`mailto:${b.email}`} className="hover:text-brand truncate">{b.email}</a></div>}
              {b.phone && <div className="flex items-center gap-2 text-gray-500"><Phone className="w-3.5 h-3.5 flex-shrink-0" /><a href={`tel:${b.phone}`} className="hover:text-brand">{b.phone}</a></div>}
              {b.address && <p className="text-gray-400 text-xs leading-relaxed">{b.address}</p>}
              <p className="text-xs text-gray-400">Currency: <span className="font-semibold text-gray-600 dark:text-gray-300">{b.currency}</span></p>
            </div>

            <Link href={`/admin/export-dashboard/countries/${countryId}/buyers/${b._id}`}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}>
              <Ship className="w-4 h-4" /> View Shipments
            </Link>
          </div>
        ))}

        {buyers.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No companies yet for {country?.name}</p>
          </div>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Company' : 'Add Company'}
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <Input label="Company Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Sarl Espoir" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} />
            <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Address</label>
            <textarea rows={2} value={form.address} onChange={e => set('address', e.target.value)} className="input-field resize-none text-sm" placeholder="148 Rue du Faubourg..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tax ID / VAT" value={form.taxId} onChange={e => set('taxId', e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input-field">
                {['EUR', 'USD', 'GBP', 'AED', 'SAR', 'SGD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field resize-none text-sm" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

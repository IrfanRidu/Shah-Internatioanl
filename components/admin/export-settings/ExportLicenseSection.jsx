'use client';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FileBadge, Upload } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import toast from 'react-hot-toast';
import { resizeImageFile } from '@/lib/clientImageResize';

const EMPTY = { licenseType: '', licenseName: '', licenseNo: '', activationDate: '', expiryDate: '', letterheadUrl: '', tinNo: '', binNo: '', rexNo: '', ercNumber: '', address: '', ownerName: '', phone: '', email: '' };
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function ExportLicenseSection({ categories }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchItems = async () => {
    setLoading(true);
    const r = await fetch('/api/export/licenses');
    const d = await r.json();
    setItems(d.items || []);
    setLoading(false);
  };
  useEffect(() => { fetchItems(); }, []);

  const openNew = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (l) => {
    setEdit(l);
    setForm({
      licenseType: l.licenseType?._id || l.licenseType || '', licenseName: l.licenseName, licenseNo: l.licenseNo || '',
      activationDate: toDateInput(l.activationDate), expiryDate: toDateInput(l.expiryDate),
      letterheadUrl: l.letterheadUrl || '', tinNo: l.tinNo || '', binNo: l.binNo || '', rexNo: l.rexNo || '',
      ercNumber: l.ercNumber || '', address: l.address || '', ownerName: l.ownerName || '', phone: l.phone || '', email: l.email || '',
    });
    setModal(true);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    // This is a per-license letterhead — same "used as the actual PDF page background" role as the
    // global one in Website Settings, so it gets the same generous resolution ceiling (still
    // resized client-side first — see resizeImageFile's own comment on why that matters on Vercel).
    resizeImageFile(file, { maxDimension: 2000, quality: 0.88 }).then((dataUrl) => {
      fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, folder: 'export-licenses' }) })
        .then((res) => res.json())
        .then((data) => { if (data.success) set('letterheadUrl', data.url); else toast.error(data.message || 'Upload failed'); })
        .finally(() => setUploading(false));
    }).catch((err) => { toast.error(err.message || 'Upload failed'); setUploading(false); });
  };

  const handleSave = async () => {
    if (!form.licenseName.trim() || !form.expiryDate || !form.letterheadUrl || !form.tinNo.trim() || !form.binNo.trim()) {
      toast.error('License Name, Expiry Date, Letterhead, TIN and BIN are mandatory'); return;
    }
    setSaving(true);
    const url = edit ? `/api/export/licenses/${edit._id}` : '/api/export/licenses';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      licenseType: form.licenseType || undefined, licenseName: form.licenseName, licenseNo: form.licenseNo,
      activationDate: form.activationDate || undefined, expiryDate: form.expiryDate,
      letterheadUrl: form.letterheadUrl, tinNo: form.tinNo, binNo: form.binNo, rexNo: form.rexNo,
      ercNumber: form.ercNumber, address: form.address, ownerName: form.ownerName, phone: form.phone, email: form.email,
    }) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetchItems(); } else toast.error(d.message);
  };

  const handleDelete = async (l) => {
    if (!confirm(`Remove "${l.licenseName}"? Shipments that already selected it will keep their saved TIN/BIN/letterhead.`)) return;
    await fetch(`/api/export/licenses/${l._id}`, { method: 'DELETE' });
    fetchItems();
    toast.success('Removed');
  };

  const isExpired = (l) => l.expiryDate && new Date(l.expiryDate) < new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">Export License Configuration</h2>
          <p className="text-sm text-gray-400">Saved export licenses — pick one on a shipment to auto-fill its TIN, BIN, and document letterhead.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew}>Add Export License</Button>
      </div>

      {loading ? <Loader /> : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileBadge className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-medium">No export licenses configured yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(l => (
            <div key={l._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-start justify-between mb-3">
                {l.letterheadUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.letterheadUrl} alt="Letterhead" className="h-10 w-auto max-w-[120px] object-contain bg-gray-50 rounded-lg border border-gray-100 p-1" />
                ) : <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center"><FileBadge className="w-5 h-5 text-purple-500" /></div>}
                <div className="flex gap-1">
                  <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(l)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">{l.licenseName}</h3>
              {l.licenseType?.name && <p className="text-xs text-gray-400">{l.licenseType.name}</p>}
              {l.licenseNo && <p className="text-xs text-gray-400">No: {l.licenseNo}</p>}
              <div className="flex gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                <span>TIN: {l.tinNo}</span>
                <span>BIN: {l.binNo}</span>
                {l.rexNo && <span>REX: {l.rexNo}</span>}
                {l.ercNumber && <span>ERC: {l.ercNumber}</span>}
              </div>
              {l.ownerName && <p className="text-xs text-gray-400 mt-1">{l.ownerName}</p>}
              {l.expiryDate && (
                <p className={`text-xs mt-1.5 font-medium ${isExpired(l) ? 'text-red-500' : 'text-gray-400'}`}>
                  {isExpired(l) ? '⚠️ Expired' : 'Expires'} {new Date(l.expiryDate).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Export License' : 'Add Export License'}
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">License Type</label>
            <select value={form.licenseType} onChange={e => set('licenseType', e.target.value)} className="input-field">
              <option value="">— Select Export Category —</option>
              {(categories || []).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            {(!categories || categories.length === 0) && (
              <p className="text-xs text-amber-600 mt-1">No Export Categories yet — add one in the "🏷️ Export Categories" tab first, then come back here to pick it.</p>
            )}
          </div>
          <Input label="License Name" required value={form.licenseName} onChange={e => set('licenseName', e.target.value)} />
          <Input label="License No" value={form.licenseNo} onChange={e => set('licenseNo', e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Activation Date" type="date" value={form.activationDate} onChange={e => set('activationDate', e.target.value)} />
            <Input label="Expiry Date" type="date" required value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="TIN" required value={form.tinNo} onChange={e => set('tinNo', e.target.value)} />
            <Input label="BIN" required value={form.binNo} onChange={e => set('binNo', e.target.value)} />
          </div>
          <Input label="REX No" value={form.rexNo} onChange={e => set('rexNo', e.target.value)} hint="Optional — auto-fills a shipment's REX No, used in the Buyer's Invoice declaration" />
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">License Holder Details</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="ERC Number" value={form.ercNumber} onChange={e => set('ercNumber', e.target.value)} hint="Export Registration Certificate Number" />
                <Input label="Owner Name" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
              </div>
              <Input label="Address" value={form.address} onChange={e => set('address', e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
                <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">License Letterhead <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3">
              {form.letterheadUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.letterheadUrl} alt="" className="h-12 w-auto max-w-[160px] object-contain bg-gray-50 rounded-lg border border-gray-100 p-1" />
              )}
              <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : form.letterheadUrl ? 'Replace' : 'Upload Letterhead'}
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">Used as the document header on this license's shipments, instead of the global company letterhead.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

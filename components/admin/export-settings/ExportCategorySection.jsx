'use client';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag, Upload, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import toast from 'react-hot-toast';
import { resizeImageFile } from '@/lib/clientImageResize';
import { AVAILABLE_COLUMNS, COLUMN_LABELS, DEFAULT_DOCUMENT_COLUMNS, DOC_KEYS, DOC_LABELS } from '@/lib/exportColumns';

const EMPTY = {
  name: '', image: '', hsCode: '', incentivePercentage: '', taxPercentage: '', incentiveApplicationCost: '', othersCost: '',
  documentColumns: { packingList: [...DEFAULT_DOCUMENT_COLUMNS.packingList], buyerInvoice: [...DEFAULT_DOCUMENT_COLUMNS.buyerInvoice], bdInvoice: [...DEFAULT_DOCUMENT_COLUMNS.bdInvoice] },
  bdInvoiceShowHsCode: true,
};

export default function ExportCategorySection({ currency }) {
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
    const r = await fetch('/api/export/categories');
    const d = await r.json();
    setItems(d.items || []);
    setLoading(false);
  };
  useEffect(() => { fetchItems(); }, []);

  const openNew = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (c) => {
    setEdit(c);
    setForm({
      name: c.name, image: c.image || '', hsCode: c.hsCode || '',
      incentivePercentage: c.incentivePercentage ?? '', taxPercentage: c.taxPercentage ?? '',
      incentiveApplicationCost: c.incentiveApplicationCost ?? '', othersCost: c.othersCost ?? '',
      documentColumns: {
        packingList: c.documentColumns?.packingList?.length ? [...c.documentColumns.packingList] : [...DEFAULT_DOCUMENT_COLUMNS.packingList],
        buyerInvoice: c.documentColumns?.buyerInvoice?.length ? [...c.documentColumns.buyerInvoice] : [...DEFAULT_DOCUMENT_COLUMNS.buyerInvoice],
        bdInvoice: c.documentColumns?.bdInvoice?.length ? [...c.documentColumns.bdInvoice] : [...DEFAULT_DOCUMENT_COLUMNS.bdInvoice],
      },
      bdInvoiceShowHsCode: c.bdInvoiceShowHsCode !== false,
    });
    setModal(true);
  };

  // Toggling adds/removes freely; order is normalized back to the registry's canonical order at
  // save time (see handleSave) so admin click order never affects the printed column order.
  const toggleColumn = (docKey, colKey) => {
    setForm(p => {
      const current = p.documentColumns[docKey] || [];
      const next = current.includes(colKey) ? current.filter(k => k !== colKey) : [...current, colKey];
      return { ...p, documentColumns: { ...p.documentColumns, [docKey]: next } };
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    // Resized client-side first — see resizeImageFile's own comment on why that matters on Vercel.
    resizeImageFile(file, { maxDimension: 1200, quality: 0.85 }).then((dataUrl) => {
      fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, folder: 'export-categories' }) })
        .then((res) => res.json())
        .then((data) => { if (data.success) set('image', data.url); else toast.error(data.message || 'Image upload failed'); })
        .finally(() => setUploading(false));
    }).catch((err) => { toast.error(err.message || 'Image upload failed'); setUploading(false); });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Category name is required'); return; }
    setSaving(true);
    const url = edit ? `/api/export/categories/${edit._id}` : '/api/export/categories';
    const method = edit ? 'PUT' : 'POST';
    // Normalize each document's selected columns back to the registry's canonical order,
    // regardless of the order checkboxes were clicked in.
    const normalizedColumns = {};
    DOC_KEYS.forEach(docKey => {
      const selected = new Set(form.documentColumns[docKey] || []);
      normalizedColumns[docKey] = AVAILABLE_COLUMNS[docKey].filter(k => selected.has(k));
    });
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name: form.name, image: form.image, hsCode: form.hsCode,
      incentivePercentage: Number(form.incentivePercentage) || 0,
      taxPercentage: Number(form.taxPercentage) || 0,
      incentiveApplicationCost: Number(form.incentiveApplicationCost) || 0,
      othersCost: Number(form.othersCost) || 0,
      documentColumns: normalizedColumns,
      bdInvoiceShowHsCode: !!form.bdInvoiceShowHsCode,
    }) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetchItems(); } else toast.error(d.message);
  };

  const handleDelete = async (c) => {
    if (!confirm(`Remove the "${c.name}" export category? Shipments/licenses already using it will keep their saved reference.`)) return;
    await fetch(`/api/export/categories/${c._id}`, { method: 'DELETE' });
    fetchItems();
    toast.success('Removed');
  };

  // Requirement 8's exact responsive rule: 1 column by default, 2 once there are more than 4
  // categories, 3 once there are more than 8.
  const gridClass = items.length > 8 ? 'sm:grid-cols-2 lg:grid-cols-3' : items.length > 4 ? 'sm:grid-cols-2' : '';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">Export Categories</h2>
          <p className="text-sm text-gray-400">Each category drives its shipments' incentive calculation, shows its image on shipment cards, and defines its own Packing List / Buyer's Invoice / BD Invoice document format below.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew}>Add Export Category</Button>
      </div>

      {loading ? <Loader /> : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Tag className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-medium">No export categories configured yet</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${gridClass} gap-4`}>
          {items.map(c => (
            <div key={c._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 flex gap-4">
              <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                ) : <Tag className="w-6 h-6 text-gray-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{c.name}</h3>
                    {c.hsCode && <p className="text-xs text-gray-400">HS Code: {c.hsCode}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-500">
                  <span>Incentive: {c.incentivePercentage}%</span>
                  <span>Tax: {c.taxPercentage}%</span>
                  <span>App. Cost: {currency} {c.incentiveApplicationCost}</span>
                  <span>Other: {currency} {c.othersCost}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Export Category' : 'Add Export Category'}
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category Image</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {form.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image} alt="" className="w-full h-full object-cover" />
                ) : <Tag className="w-6 h-6 text-gray-300" />}
              </div>
              <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload Image'}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Category Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fresh Fruits and Vegetable" />
            <Input label="HS Code" value={form.hsCode} onChange={e => set('hsCode', e.target.value)} placeholder="e.g. 79714" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Incentive %" type="number" min="0" max="100" value={form.incentivePercentage} onChange={e => set('incentivePercentage', e.target.value)} placeholder="e.g. 10" />
            <Input label="Tax %" type="number" min="0" max="100" value={form.taxPercentage} onChange={e => set('taxPercentage', e.target.value)} placeholder="e.g. 5" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={`Incentive Application Cost (${currency})`} type="number" min="0" value={form.incentiveApplicationCost} onChange={e => set('incentiveApplicationCost', e.target.value)} placeholder="e.g. 2000" />
            <Input label={`Others Cost (${currency})`} type="number" min="0" value={form.othersCost} onChange={e => set('othersCost', e.target.value)} placeholder="e.g. 1000" />
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-1 mt-3">
              <FileText className="w-4 h-4 text-brand" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Document Format</p>
            </div>
            <p className="text-xs text-gray-400 mb-3">Choose which extra columns appear on this category's shipments. "Fresh Fruits and Vegetables" ships with sensible defaults already checked — untick/tick to fit a different product type.</p>
            <div className="space-y-3">
              {DOC_KEYS.map(docKey => (
                <div key={docKey} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">{DOC_LABELS[docKey]}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {AVAILABLE_COLUMNS[docKey].map(colKey => (
                      <label key={colKey} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                        <input type="checkbox" checked={form.documentColumns[docKey].includes(colKey)} onChange={() => toggleColumn(docKey, colKey)} className="rounded border-gray-300" />
                        {COLUMN_LABELS[colKey]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none px-1">
                <input type="checkbox" checked={form.bdInvoiceShowHsCode} onChange={e => set('bdInvoiceShowHsCode', e.target.checked)} className="rounded border-gray-300" />
                Show H.S. Code under the product name on the BD Invoice
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

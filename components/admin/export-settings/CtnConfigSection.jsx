'use client';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import toast from 'react-hot-toast';

const EMPTY = { ctnSizeKg: '', ctnWeightGm: '', ctnCost: '' };

export default function CtnConfigSection({ currency }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchItems = async () => {
    setLoading(true);
    const r = await fetch('/api/export/ctn-configs');
    const d = await r.json();
    setItems(d.items || []);
    setLoading(false);
  };
  useEffect(() => { fetchItems(); }, []);

  const openNew = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (c) => { setEdit(c); setForm({ ctnSizeKg: c.ctnSizeKg, ctnWeightGm: c.ctnWeightGm, ctnCost: c.ctnCost }); setModal(true); };

  const handleSave = async () => {
    if (!form.ctnSizeKg || !form.ctnWeightGm || form.ctnCost === '') { toast.error('Fill all fields'); return; }
    setSaving(true);
    const url = edit ? `/api/export/ctn-configs/${edit._id}` : '/api/export/ctn-configs';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      ctnSizeKg: Number(form.ctnSizeKg), ctnWeightGm: Number(form.ctnWeightGm), ctnCost: Number(form.ctnCost),
    }) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetchItems(); } else toast.error(d.message);
  };

  const handleDelete = async (c) => {
    if (!confirm(`Remove the ${c.ctnSizeKg}kg CTN size preset?`)) return;
    await fetch(`/api/export/ctn-configs/${c._id}`, { method: 'DELETE' });
    fetchItems();
    toast.success('Removed');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">CTN Configuration</h2>
          <p className="text-sm text-gray-400">Carton size presets — suggested while entering CTN Size on any shipment's items, and used to auto-calculate each item's total CTN weight.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew}>Add CTN Size</Button>
      </div>

      {loading ? <Loader /> : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-medium">No CTN sizes configured yet</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left text-gray-500">
              <tr><th className="px-4 py-3">CTN Size (kg)</th><th className="px-4 py-3">CTN Weight (gm)</th><th className="px-4 py-3">CTN Cost ({currency})</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {items.map(c => (
                <tr key={c._id}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.ctnSizeKg} kg</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.ctnWeightGm} gm</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{currency} {c.ctnCost}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit CTN Size' : 'Add CTN Size'}
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <Input label="CTN Size (kg)" type="number" min="0" step="0.01" required value={form.ctnSizeKg} onChange={e => set('ctnSizeKg', e.target.value)} placeholder="e.g. 1.5" />
          <Input label="CTN Weight (gm)" type="number" min="0" required value={form.ctnWeightGm} onChange={e => set('ctnWeightGm', e.target.value)} placeholder="e.g. 220" />
          <Input label={`CTN Cost (${currency})`} type="number" min="0" step="0.01" required value={form.ctnCost} onChange={e => set('ctnCost', e.target.value)} placeholder="e.g. 34" />
        </div>
      </Modal>
    </div>
  );
}

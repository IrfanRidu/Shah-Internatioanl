'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import { Plus, Edit2, Trash2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isAfter, isBefore } from 'date-fns';

const EMPTY = { code: '', description: '', type: 'percentage', value: '', minimumOrderAmount: '0', maximumDiscount: '', usageLimit: '', validFrom: '', validUntil: '', isActive: true, applicableFor: 'all' };

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetch_ = async () => { setLoading(true); const r = await fetch('/api/coupons'); const d = await r.json(); setCoupons(d.coupons || []); setLoading(false); };
  useEffect(() => { fetch_(); }, []);

  const openNew = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (c) => { setEdit(c); setForm({ ...c, validFrom: c.validFrom ? new Date(c.validFrom).toISOString().slice(0, 10) : '', validUntil: c.validUntil ? new Date(c.validUntil).toISOString().slice(0, 10) : '' }); setModal(true); };

  const handleSave = async () => {
    if (!form.code || !form.value || !form.validFrom || !form.validUntil) { toast.error('Fill all required fields'); return; }
    setSaving(true);
    const url = edit ? `/api/coupons/${edit._id}` : '/api/coupons';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, value: Number(form.value), minimumOrderAmount: Number(form.minimumOrderAmount) || 0, maximumDiscount: form.maximumDiscount ? Number(form.maximumDiscount) : undefined, usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined }) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetch_(); } else toast.error(d.message);
  };

  const now = new Date();
  const getStatus = (c) => {
    if (!c.isActive) return { label: 'Inactive', variant: 'default' };
    if (isBefore(now, new Date(c.validFrom))) return { label: 'Upcoming', variant: 'info' };
    if (isAfter(now, new Date(c.validUntil))) return { label: 'Expired', variant: 'danger' };
    if (c.usageLimit && c.usedCount >= c.usageLimit) return { label: 'Used Up', variant: 'danger' };
    return { label: 'Active', variant: 'success' };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Coupons</h1>
        <Button variant="primary" icon={Plus} onClick={openNew}>New Coupon</Button>
      </div>
      {loading ? <Loader /> : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              <tr>{['Code', 'Discount', 'Min Order', 'Usage', 'Valid Until', 'For', 'Status', 'Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody>
              {coupons.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">No coupons yet</td></tr> : coupons.map(c => {
                const { label, variant } = getStatus(c);
                return (
                  <tr key={c._id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="font-bold text-brand bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded text-sm">{c.code}</code>
                        <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success('Copied!'); }}><Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">{c.type === 'percentage' ? `${c.value}%` : `৳${c.value}`}</td>
                    <td className="px-4 py-3 text-gray-500">৳{c.minimumOrderAmount || 0}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.usedCount}/{c.usageLimit || '∞'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(c.validUntil), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3"><Badge variant="info" className="text-xs capitalize">{c.applicableFor}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={variant} className="text-xs">{label}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={async () => { if (!confirm('Delete?')) return; await fetch(`/api/coupons/${c._id}`, { method: 'DELETE' }); fetch_(); toast.success('Deleted'); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Coupon' : 'New Coupon'} size="md"
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save Coupon</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Coupon Code" required value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SAVE20" />
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className="input-field"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed (৳)</option></select></div>
          <Input label={form.type === 'percentage' ? 'Discount %' : 'Discount Amount (৳)'} required type="number" value={form.value} onChange={e => set('value', e.target.value)} placeholder={form.type === 'percentage' ? '10' : '100'} />
          <Input label="Max Discount (৳)" type="number" value={form.maximumDiscount} onChange={e => set('maximumDiscount', e.target.value)} placeholder="Optional cap" />
          <Input label="Min Order (৳)" type="number" value={form.minimumOrderAmount} onChange={e => set('minimumOrderAmount', e.target.value)} placeholder="0" />
          <Input label="Usage Limit" type="number" value={form.usageLimit} onChange={e => set('usageLimit', e.target.value)} placeholder="Unlimited" />
          <Input label="Valid From" type="date" required value={form.validFrom} onChange={e => set('validFrom', e.target.value)} />
          <Input label="Valid Until" type="date" required value={form.validUntil} onChange={e => set('validUntil', e.target.value)} />
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Applicable For</label>
            <select value={form.applicableFor} onChange={e => set('applicableFor', e.target.value)} className="input-field"><option value="all">All Buyers</option><option value="local">Local Only</option><option value="international">International Only</option></select></div>
          <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Internal note" />
        </div>
      </Modal>
    </div>
  );
}

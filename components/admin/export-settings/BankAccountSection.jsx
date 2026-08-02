'use client';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Landmark } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import toast from 'react-hot-toast';

const EMPTY = { beneficiaryBank: '', accountNo: '', branch: '', bankAddress: '', routingNo: '', swiftCode: '' };
const REQUIRED = ['beneficiaryBank', 'accountNo', 'branch', 'bankAddress', 'routingNo', 'swiftCode'];

export default function BankAccountSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchItems = async () => {
    setLoading(true);
    const r = await fetch('/api/export/bank-accounts');
    const d = await r.json();
    setItems(d.items || []);
    setLoading(false);
  };
  useEffect(() => { fetchItems(); }, []);

  const openNew = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (b) => { setEdit(b); setForm({ beneficiaryBank: b.beneficiaryBank, accountNo: b.accountNo, branch: b.branch, bankAddress: b.bankAddress, routingNo: b.routingNo, swiftCode: b.swiftCode }); setModal(true); };

  const handleSave = async () => {
    if (REQUIRED.some(k => !form[k]?.trim())) { toast.error('All fields are mandatory'); return; }
    setSaving(true);
    const url = edit ? `/api/export/bank-accounts/${edit._id}` : '/api/export/bank-accounts';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetchItems(); } else toast.error(d.message);
  };

  const handleDelete = async (b) => {
    if (!confirm(`Remove "${b.beneficiaryBank}"? Shipments that already selected it will keep their saved details.`)) return;
    await fetch(`/api/export/bank-accounts/${b._id}`, { method: 'DELETE' });
    fetchItems();
    toast.success('Removed');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">Bank Account Configuration</h2>
          <p className="text-sm text-gray-400">Saved company bank accounts — pick one on a shipment to auto-fill its BD Invoice bank details.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew}>Add Bank Account</Button>
      </div>

      {loading ? <Loader /> : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Landmark className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-medium">No bank accounts configured yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(b => (
            <div key={b._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0"><Landmark className="w-5 h-5 text-blue-500" /></div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">{b.beneficiaryBank}</h3>
              <p className="text-xs text-gray-400 mt-1">A/C: {b.accountNo}</p>
              <p className="text-xs text-gray-400">{b.branch}</p>
              <p className="text-xs text-gray-400 truncate">{b.bankAddress}</p>
              <div className="flex gap-3 mt-2 text-xs text-gray-500">
                <span>Routing: {b.routingNo}</span>
                <span>SWIFT: {b.swiftCode}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Bank Account' : 'Add Bank Account'}
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <Input label="Beneficiary Bank" required value={form.beneficiaryBank} onChange={e => set('beneficiaryBank', e.target.value)} placeholder="e.g. Sonali Bank Ltd." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Account No" required value={form.accountNo} onChange={e => set('accountNo', e.target.value)} />
            <Input label="Branch" required value={form.branch} onChange={e => set('branch', e.target.value)} />
          </div>
          <Input label="Bank Address" required value={form.bankAddress} onChange={e => set('bankAddress', e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Routing No" required value={form.routingNo} onChange={e => set('routingNo', e.target.value)} />
            <Input label="SWIFT Code" required value={form.swiftCode} onChange={e => set('swiftCode', e.target.value.toUpperCase())} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

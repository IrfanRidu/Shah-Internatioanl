'use client';
import { useState, useEffect, useCallback } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { AlertTriangle, Plus, Minus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminInventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'in', quantity: '', reason: '' });
  const [adjusting, setAdjusting] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inventory${lowStockOnly ? '?lowStock=true' : ''}`);
    const data = await res.json();
    setInventory(data.inventory || []);
    setLoading(false);
  }, [lowStockOnly]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const handleAdjust = async () => {
    if (!adjustForm.quantity || !adjustForm.reason) { toast.error('Fill all fields'); return; }
    setAdjusting(true);
    const res = await fetch(`/api/inventory/${adjustModal._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: adjustForm.type, quantity: Number(adjustForm.quantity), reason: adjustForm.reason }) });
    const data = await res.json();
    setAdjusting(false);
    if (data.success) { toast.success('Stock updated'); setAdjustModal(null); fetchInventory(); }
    else toast.error(data.message);
  };

  const lowStockCount = inventory.filter(i => i.currentStock <= i.minimumStockAlert).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
          {lowStockCount > 0 && <p className="text-sm text-red-500 flex items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3" /> {lowStockCount} items low on stock</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setLowStockOnly(!lowStockOnly)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${lowStockOnly ? 'bg-red-50 border-red-300 text-red-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <AlertTriangle className="w-4 h-4" /> {lowStockOnly ? 'Show All' : 'Low Stock Only'}
          </button>
          <button onClick={fetchInventory} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all" style={{ backgroundColor: 'var(--color-primary)' }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {loading ? <Loader /> : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <tr>{['Product', 'Current Stock', 'Reserved', 'Available', 'Min Alert', 'Status', 'Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody>
                {inventory.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">No inventory records</td></tr> : inventory.map(inv => {
                  const isLow = inv.currentStock <= inv.minimumStockAlert;
                  return (
                    <tr key={inv._id} className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${isLow ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{inv.product?.name}</td>
                      <td className="px-4 py-3 font-bold text-gray-800 dark:text-white">{inv.currentStock} <span className="text-xs text-gray-400 font-normal">{inv.product?.unit}</span></td>
                      <td className="px-4 py-3 text-amber-600">{inv.reservedStock}</td>
                      <td className="px-4 py-3 text-green-600 font-semibold">{inv.availableStock}</td>
                      <td className="px-4 py-3 text-gray-400">{inv.minimumStockAlert}</td>
                      <td className="px-4 py-3">{isLow ? <Badge variant="danger">⚠️ Low Stock</Badge> : <Badge variant="success">✓ OK</Badge>}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setAdjustModal(inv); setAdjustForm({ type: 'in', quantity: '', reason: '' }); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all" style={{ backgroundColor: 'var(--color-primary)' }}>
                          <Plus className="w-3 h-3" /> Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={!!adjustModal} onClose={() => setAdjustModal(null)} title={`Adjust Stock: ${adjustModal?.product?.name}`} size="sm"
        footer={<div className="flex gap-3"><Button onClick={handleAdjust} loading={adjusting} variant="primary">Update Stock</Button><Button onClick={() => setAdjustModal(null)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Adjustment Type</label>
            <div className="flex gap-3">
              {[{ v: 'in', label: '+ Add Stock', icon: Plus }, { v: 'out', label: '- Remove Stock', icon: Minus }, { v: 'adjustment', label: '= Set Total', icon: RefreshCw }].map(({ v, label, icon: Icon }) => (
                <button key={v} onClick={() => setAdjustForm(p => ({ ...p, type: v }))} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${adjustForm.type === v ? 'border-brand text-brand bg-green-50' : 'border-gray-200 text-gray-500'}`}>
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          </div>
          <Input label="Quantity" type="number" required value={adjustForm.quantity} onChange={e => setAdjustForm(p => ({ ...p, quantity: e.target.value }))} placeholder="Enter quantity" />
          <Input label="Reason" required value={adjustForm.reason} onChange={e => setAdjustForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. New shipment received, Damaged goods..." />
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-xs text-gray-500">
            <p>Current: <strong>{adjustModal?.currentStock} {adjustModal?.product?.unit}</strong></p>
            <p>Available: <strong>{adjustModal?.availableStock}</strong></p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

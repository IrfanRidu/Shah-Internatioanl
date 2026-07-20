'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSectionsPage() {
  const [sections, setSections] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const [form, setForm] = useState({ title: '', description: '', badge: '', products: [], isActive: true, position: 'home', displayOrder: 0, targetAudience: 'all' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetch_ = async () => { setLoading(true); const [sr, pr] = await Promise.all([fetch('/api/special-sections?adminView=true'), fetch('/api/products?limit=100&adminView=true')]); const [sd, pd] = await Promise.all([sr.json(), pr.json()]); setSections(sd.sections || []); setProducts(pd.products || []); setLoading(false); };
  useEffect(() => { fetch_(); }, []);

  const openNew = () => { setEdit(null); setForm({ title: '', description: '', badge: '', products: [], isActive: true, position: 'home', displayOrder: 0, targetAudience: 'all' }); setModal(true); };
  const openEdit = (s) => { setEdit(s); setForm({ ...s, products: (s.products || []).map(p => p._id || p) }); setModal(true); };
  const toggleProduct = (id) => setForm(p => ({ ...p, products: p.products.includes(id) ? p.products.filter(x => x !== id) : [...p.products, id] }));
  const handleSave = async () => {
    if (!form.title) { toast.error('Title required'); return; }
    setSaving(true);
    const url = edit ? `/api/special-sections/${edit._id}` : '/api/special-sections';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetch_(); } else toast.error(d.message);
  };
  const toggleActive = async (s) => { await fetch(`/api/special-sections/${s._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !s.isActive }) }); setSections(prev => prev.map(x => x._id === s._id ? { ...x, isActive: !x.isActive } : x)); };
  const filtered = products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Special Sections</h1><Button variant="primary" icon={Plus} onClick={openNew}>New Section</Button></div>
      {loading ? <Loader /> : (
        <div className="space-y-4">
          {sections.map(s => (
            <div key={s._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-bold text-gray-900 dark:text-white">{s.title}</p>
                  {s.badge && <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-medium">{s.badge}</span>}
                  <Badge variant={s.isActive ? 'success' : 'default'} className="text-xs">{s.isActive ? 'Visible' : 'Hidden'}</Badge>
                  <Badge variant="info" className="text-xs capitalize">{s.position}</Badge>
                </div>
                {s.description && <p className="text-sm text-gray-500 mb-2">{s.description}</p>}
                <p className="text-xs text-gray-400">{s.products?.length || 0} products · Audience: {s.targetAudience}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(s)}>{s.isActive ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}</button>
                <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-4 h-4" /></button>
                <button onClick={async () => { if (!confirm('Delete?')) return; await fetch(`/api/special-sections/${s._id}`, { method: 'DELETE' }); fetch_(); toast.success('Deleted'); }} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {sections.length === 0 && <div className="text-center py-16 text-gray-400">No sections yet</div>}
        </div>
      )}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Section' : 'New Section'} size="xl"
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save Section</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Input label="Section Title" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Best Sellers" />
          <Input label="Badge Text" value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="e.g. Hot 🔥" />
          <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional subtitle" />
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Position</label>
            <select value={form.position} onChange={e => set('position', e.target.value)} className="input-field"><option value="home">Home Page</option><option value="productDetail">Product Detail</option><option value="both">Both</option></select></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Target Audience</label>
            <select value={form.targetAudience} onChange={e => set('targetAudience', e.target.value)} className="input-field"><option value="all">All</option><option value="local">Local</option><option value="international">International</option></select></div>
          <Input label="Display Order" type="number" value={form.displayOrder} onChange={e => set('displayOrder', Number(e.target.value))} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Select Products ({form.products.length} selected)</p>
          <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search products..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} className="input-field pl-9 py-2 text-sm" /></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {filtered.slice(0, 30).map(p => (
              <label key={p._id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all text-sm ${form.products.includes(p._id) ? 'border-brand bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                <input type="checkbox" checked={form.products.includes(p._id)} onChange={() => toggleProduct(p._id)} className="w-3.5 h-3.5 accent-green-600" />
                <span className="truncate text-gray-700 dark:text-gray-300">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

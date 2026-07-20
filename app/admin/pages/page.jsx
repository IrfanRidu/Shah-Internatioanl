'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import { Plus, Edit2, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

// Outside the page component — prevents re-mounting on every state change
// which would kill focus on text inputs.
function Toggle({ fieldKey, label, value, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(fieldKey, !value)}
        className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${value ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: value ? '22px' : '2px' }} />
      </button>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  );
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', content: '', metaTitle: '', metaDescription: '', isActive: true, showInHeader: false, showInFooter: false, displayOrder: 0 });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetch_ = async () => {
    setLoading(true);
    const r = await fetch('/api/pages');
    const d = await r.json();
    setPages(d.pages || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const openNew = () => {
    setEdit(null);
    setForm({ title: '', slug: '', content: '', metaTitle: '', metaDescription: '', isActive: true, showInHeader: false, showInFooter: false, displayOrder: 0 });
    setModal(true);
  };

  const openEdit = (p) => { setEdit(p); setForm(p); setModal(true); };

  const handleSave = async () => {
    if (!form.title || !form.slug) { toast.error('Title and slug required'); return; }
    setSaving(true);
    const url = edit ? `/api/pages/${edit._id}` : '/api/pages';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Saved!'); setModal(false); fetch_(); } else toast.error(d.message);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pages</h1>
        <Button variant="primary" icon={Plus} onClick={openNew}>New Page</Button>
      </div>

      {loading ? <Loader /> : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              <tr>{['Title', 'Slug', 'Header', 'Footer', 'Status', 'Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody>
              {pages.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No pages yet</td></tr>
              ) : pages.map(p => (
                <tr key={p._id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{p.title}</td>
                  <td className="px-4 py-3"><code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">/{p.slug}</code></td>
                  <td className="px-4 py-3">{p.showInHeader ? <Badge variant="success" className="text-xs">Yes</Badge> : <span className="text-gray-400 text-xs">No</span>}</td>
                  <td className="px-4 py-3">{p.showInFooter ? <Badge variant="success" className="text-xs">Yes</Badge> : <span className="text-gray-400 text-xs">No</span>}</td>
                  <td className="px-4 py-3"><Badge variant={p.isActive ? 'success' : 'default'} className="text-xs">{p.isActive ? 'Active' : 'Draft'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <a href={`/pages/${p.slug}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"><Eye className="w-4 h-4" /></a>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={async () => { if (!confirm('Delete?')) return; await fetch(`/api/pages/${p._id}`, { method: 'DELETE' }); fetch_(); toast.success('Deleted'); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Page' : 'New Page'} size="xl"
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save Page</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Page Title" required value={form.title} onChange={e => { set('title', e.target.value); if (!edit) set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')); }} placeholder="About Us" />
            <Input label="URL Slug" required value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="about-us" hint="Will be accessible at /pages/about-us" />
            <Input label="Meta Title" value={form.metaTitle} onChange={e => set('metaTitle', e.target.value)} placeholder="SEO title" />
            <Input label="Meta Description" value={form.metaDescription} onChange={e => set('metaDescription', e.target.value)} placeholder="SEO description" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Page Content</label>
            <textarea rows={10} value={form.content} onChange={e => set('content', e.target.value)} className="input-field resize-y font-mono text-sm" placeholder="Page content (HTML or plain text)..." />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Toggle fieldKey="isActive" label="Published" value={form.isActive} onChange={set} />
            <Toggle fieldKey="showInHeader" label="Show in Header" value={form.showInHeader} onChange={set} />
            <Toggle fieldKey="showInFooter" label="Show in Footer" value={form.showInFooter} onChange={set} />
            <Input label="Order" type="number" value={form.displayOrder} onChange={e => set('displayOrder', Number(e.target.value))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

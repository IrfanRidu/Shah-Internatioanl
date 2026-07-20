'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Loader from '@/components/ui/Loader';
import { Plus, Edit2, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { resizeImageFile } from '@/lib/clientImageResize';
import toast from 'react-hot-toast';

async function uploadImg(file) {
  const dataUrl = await resizeImageFile(file, { maxDimension: 800, quality: 0.85 });
  const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, folder: 'categories' }) });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Upload failed');
  return data.url;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', image: '', subcategories: [] });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchCategories = async () => {
    setLoading(true);
    const d = await fetch('/api/categories?adminView=true').then(r => r.json());
    setCategories(d.categories || []);
    setLoading(false);
  };
  useEffect(() => { fetchCategories(); }, []);

  const openNew = () => { setEditCat(null); setForm({ name: '', description: '', image: '', subcategories: [] }); setModalOpen(true); };
  const openEdit = (cat) => { setEditCat(cat); setForm({ name: cat.name, description: cat.description || '', image: cat.image || '', subcategories: cat.subcategories || [] }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name) { toast.error('Category name required'); return; }
    setSaving(true);
    const url = editCat ? `/api/categories/${editCat._id}` : '/api/categories';
    const data = await fetch(url, { method: editCat ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).then(r => r.json());
    setSaving(false);
    if (data.success) { toast.success(editCat ? 'Updated!' : 'Created!'); setModalOpen(false); fetchCategories(); }
    else toast.error(data.message);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category?')) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    fetchCategories(); toast.success('Deleted');
  };

  const addSubcat = () => setForm(p => ({ ...p, subcategories: [...p.subcategories, { name: '', slug: '', image: '' }] }));
  const removeSubcat = (i) => setForm(p => ({ ...p, subcategories: p.subcategories.filter((_, idx) => idx !== i) }));
  const setSubcat = (i, k, v) => setForm(p => { const s = [...p.subcategories]; s[i] = { ...s[i], [k]: v }; return { ...p, subcategories: s }; });

  const handleUpload = async (e, field, subcatIdx) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImg(file);
      subcatIdx !== undefined ? setSubcat(subcatIdx, field, url) : set(field, url);
      toast.success('Uploaded!');
    } catch (err) { toast.error(err.message || 'Upload failed'); }
    setUploading(false);
  };

  if (loading) return <Loader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
        <Button variant="primary" icon={Plus} onClick={openNew}>Add Category</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div key={cat._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                {cat.image
                  ? <img src={cat.image} alt={cat.name} className="w-12 h-12 rounded-xl object-cover bg-gray-100" />
                  : <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}><ImageIcon className="w-6 h-6 text-white" /></div>
                }
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{cat.name}</p>
                  {cat.description && <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>}
                  <p className="text-xs text-gray-400">{cat.subcategories?.length || 0} subcategories</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(cat._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {cat.subcategories?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {cat.subcategories.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-300">
                    {s.image && <img src={s.image} alt={s.name} className="w-4 h-4 rounded object-cover" />}
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {categories.length === 0 && <div className="col-span-3 text-center py-16 text-gray-400">No categories yet. Create your first category.</div>}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editCat ? 'Edit Category' : 'New Category'} size="md"
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save</Button><Button onClick={() => setModalOpen(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <Input label="Category Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Vegetables" />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category Image / Icon</label>
            <div className="flex items-center gap-3">
              {form.image
                ? <img src={form.image} alt="Category" className="w-14 h-14 rounded-xl object-cover border border-gray-200" />
                : <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><ImageIcon className="w-6 h-6 text-gray-400" /></div>
              }
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50 transition-all">
                  <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading...' : 'Upload Image'}
                  <input type="file" accept="image/*" onChange={e => handleUpload(e, 'image')} className="hidden" disabled={uploading} />
                </label>
                {form.image && <button onClick={() => set('image', '')} className="text-xs text-red-400 hover:text-red-600 text-left">Remove</button>}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} className="input-field resize-none" placeholder="Brief category description..." />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subcategories</label>
              <button onClick={addSubcat} className="flex items-center gap-1 text-xs text-brand hover:underline"><Plus className="w-3 h-3" /> Add Subcategory</button>
            </div>
            <div className="space-y-2">
              {form.subcategories.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <label className="flex-shrink-0 cursor-pointer" title="Click to upload subcategory image">
                    {s.image
                      ? <img src={s.image} alt={s.name} className="w-9 h-9 rounded-lg object-cover border border-gray-200" />
                      : <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 transition-colors"><Upload className="w-3.5 h-3.5 text-gray-400" /></div>
                    }
                    <input type="file" accept="image/*" onChange={e => handleUpload(e, 'image', i)} className="hidden" disabled={uploading} />
                  </label>
                  <input value={s.name} onChange={e => setSubcat(i, 'name', e.target.value)} placeholder="Subcategory name" className="input-field py-1.5 text-sm flex-1" />
                  <button onClick={() => removeSubcat(i)} className="p-1.5 text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {form.subcategories.length === 0 && <p className="text-xs text-gray-400">No subcategories yet. Click "Add Subcategory" above.</p>}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { resizeImageFile } from '@/lib/clientImageResize';

const EMPTY = { title: '', subtitle: '', description: '', image: '', link: '', buttonText: '', type: 'hero', position: 'home', isActive: true, targetAudience: 'all', displayOrder: 0 };

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetch_ = async () => { setLoading(true); const r = await fetch('/api/banners?adminView=true'); const d = await r.json(); setBanners(d.banners || []); setLoading(false); };
  useEffect(() => { fetch_(); }, []);

  const openNew = () => { setEdit(null); setForm(EMPTY); setModal(true); };
  const openEdit = (b) => { setEdit(b); setForm(b); setModal(true); };

  const handleImg = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try {
      // Banners are wide hero images, so a larger ceiling than a typical thumbnail — still resized
      // client-side first, see resizeImageFile's own comment on why that matters on Vercel.
      const dataUrl = await resizeImageFile(file, { maxDimension: 1920, quality: 0.85 });
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, folder: 'banners' }) });
      const d = await res.json();
      if (d.success) set('image', d.url); else toast.error(d.message || 'Upload failed');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.image) { toast.error('Title and image are required'); return; }
    setSaving(true);
    const url = edit ? `/api/banners/${edit._id}` : '/api/banners';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success(edit ? 'Banner updated' : 'Banner created'); setModal(false); fetch_(); } else toast.error(d.message);
  };

  const toggleActive = async (b) => {
    await fetch(`/api/banners/${b._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !b.isActive }) });
    setBanners(prev => prev.map(x => x._id === b._id ? { ...x, isActive: !x.isActive } : x));
  };

  const deleteBanner = async (id) => {
    if (!confirm('Delete this banner?')) return;
    await fetch(`/api/banners/${id}`, { method: 'DELETE' });
    setBanners(prev => prev.filter(b => b._id !== id));
    toast.success('Deleted');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Banners</h1>
        <Button variant="primary" icon={Plus} onClick={openNew}>Add Banner</Button>
      </div>
      {loading ? <Loader /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {banners.map(b => (
            <div key={b._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              {b.image && <div className="relative h-36 bg-gray-100"><Image src={b.image} alt={b.title} fill className="object-cover" sizes="400px" /></div>}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{b.title}</p>
                    {b.subtitle && <p className="text-xs text-gray-400 mt-0.5">{b.subtitle}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge variant={b.isActive ? 'success' : 'default'} className="text-xs">{b.isActive ? 'Active' : 'Off'}</Badge>
                    <Badge variant="info" className="text-xs capitalize">{b.type}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => toggleActive(b)}>{b.isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}</button>
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => deleteBanner(b._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {banners.length === 0 && <div className="col-span-3 text-center py-16 text-gray-400">No banners yet</div>}
        </div>
      )}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Banner' : 'New Banner'} size="lg"
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save Banner</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          {form.image ? (
            <div className="relative h-32 rounded-xl overflow-hidden bg-gray-100 group">
              <Image src={form.image} alt="" fill className="object-cover" sizes="600px" />
              <button onClick={() => set('image', '')} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-brand transition-colors">
              <input type="file" accept="image/*" onChange={handleImg} className="hidden" />
              <Upload className="w-8 h-8 text-gray-300 mb-2" />
              <span className="text-sm text-gray-400">{uploading ? 'Uploading...' : 'Click to upload banner image'}</span>
            </label>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Title" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Banner title" />
            <Input label="Subtitle" value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Subtitle" />
            <Input label="Link URL" value={form.link} onChange={e => set('link', e.target.value)} placeholder="/products" />
            <Input label="Button Text" value={form.buttonText} onChange={e => set('buttonText', e.target.value)} placeholder="Shop Now" />
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="input-field">
                {['hero','promotional','popup','side'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Audience</label>
              <select value={form.targetAudience} onChange={e => set('targetAudience', e.target.value)} className="input-field">
                {['all','local','international'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Display Order" type="number" value={form.displayOrder} onChange={e => set('displayOrder', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

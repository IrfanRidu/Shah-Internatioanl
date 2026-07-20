'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { resizeImageFile } from '@/lib/clientImageResize';
import { User, Lock, MapPin, RefreshCw, Camera } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const { buyerType, setBuyerType } = useBuyerType();
  const [tab, setTab] = useState('info');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', company: '', country: '' });
  const [addr, setAddr] = useState({ street: '', area: '', city: '', district: '', zipCode: '' });
  const [pwd, setPwd] = useState({ current: '', newPass: '', confirm: '' });
  const fileRef = useRef();
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/users/${session.user.id}`).then(r => r.json()).then(d => {
        if (d.user) {
          setForm({ name: d.user.name || '', phone: d.user.phone || '', company: d.user.company || '', country: d.user.country || '' });
          setAddr(d.user.address || { street: '', area: '', city: '', district: '', zipCode: '' });
          setAvatar(d.user.avatar || null);
        }
      });
    }
  }, [session]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      // Resize/compress client-side first — avatars only need to be small
      // (200x200 server-side anyway). This is also what was most likely
      // causing "upload failed": large phone-camera photos, base64-encoded
      // at full resolution, can exceed the request body size limit.
      const resizedDataUrl = await resizeImageFile(file, { maxDimension: 600, quality: 0.85 });

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: resizedDataUrl, folder: 'avatars' }),
      });
      const data = await res.json();
      if (data.success) {
        setAvatar(data.url);
        const patchRes = await fetch(`/api/users/${session.user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: data.url }),
        });
        const patchData = await patchRes.json();
        if (!patchData.success) throw new Error(patchData.message || 'Could not save photo to your profile');
        await update({ avatar: data.url });
        toast.success('Profile photo updated!');
      } else {
        toast.error(data.message || 'Upload failed — please try a smaller image');
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed — please try again');
    }
    setUploadingAvatar(false);
  };

  const saveInfo = async () => {
    setSaving(true);
    const r = await fetch(`/api/users/${session.user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, address: addr }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Profile updated!'); await update({ name: form.name }); }
    else toast.error(d.message);
  };

  const savePassword = async () => {
    if (pwd.newPass !== pwd.confirm) { toast.error('Passwords do not match'); return; }
    if (pwd.newPass.length < 8) { toast.error('Min 8 characters'); return; }
    setSaving(true);
    const r = await fetch(`/api/users/${session.user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd.newPass }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Password changed!'); setPwd({ current: '', newPass: '', confirm: '' }); }
    else toast.error(d.message);
  };

  const tabs = [
    { id: 'info', label: 'Personal Info', icon: User },
    { id: 'address', label: 'Delivery Address', icon: MapPin },
    { id: 'password', label: 'Change Password', icon: Lock },
    { id: 'buyer', label: 'Buyer Type', icon: RefreshCw },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>My Profile</h1>

      {/* Avatar + user info */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-6 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center" style={{ backgroundColor: avatar ? undefined : 'var(--color-primary)' }}>
            {avatar ? (
              <Image src={avatar} alt="Profile" width={64} height={64} className="object-cover w-full h-full" />
            ) : (
              <span className="text-white text-2xl font-bold">{session?.user?.name?.[0]}</span>
            )}
          </div>
          {/* Upload button */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 transition-all shadow"
            title="Change photo"
          >
            {uploadingAvatar ? (
              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="w-3 h-3 text-gray-500" />
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-lg">{session?.user?.name}</p>
          <p className="text-sm text-gray-500">{session?.user?.email}</p>
          <button onClick={() => fileRef.current?.click()} className="text-xs text-brand hover:underline mt-1">
            {avatar ? 'Change photo' : 'Add profile photo'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 hover:bg-gray-50'}`} style={tab === t.id ? { backgroundColor: 'var(--color-primary)' } : {}}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
        {tab === 'info' && (
          <div className="space-y-4">
            <Input label="Full Name" value={form.name} onChange={e => set('name', e.target.value)} />
            <Input label="Phone Number" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+880..." />
            <Input label="Company / Organization" value={form.company} onChange={e => set('company', e.target.value)} />
            <Input label="Country" value={form.country} onChange={e => set('country', e.target.value)} />
            <Button onClick={saveInfo} loading={saving} variant="primary">Save Changes</Button>
          </div>
        )}

        {tab === 'address' && (
          <div className="space-y-4">
            <Input label="Street Address" value={addr.street} onChange={e => setAddr(p => ({ ...p, street: e.target.value }))} />
            <Input label="Area / Neighbourhood" value={addr.area} onChange={e => setAddr(p => ({ ...p, area: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="City" value={addr.city} onChange={e => setAddr(p => ({ ...p, city: e.target.value }))} />
              <Input label="District" value={addr.district} onChange={e => setAddr(p => ({ ...p, district: e.target.value }))} />
            </div>
            <Input label="ZIP / Postal Code" value={addr.zipCode} onChange={e => setAddr(p => ({ ...p, zipCode: e.target.value }))} />
            <Button onClick={saveInfo} loading={saving} variant="primary">Save Address</Button>
          </div>
        )}

        {tab === 'password' && (
          <div className="space-y-4">
            <Input label="New Password" type="password" value={pwd.newPass} onChange={e => setPwd(p => ({ ...p, newPass: e.target.value }))} />
            <Input label="Confirm New Password" type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} />
            <Button onClick={savePassword} loading={saving} variant="primary">Change Password</Button>
          </div>
        )}

        {tab === 'buyer' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Your buyer type determines what prices and features you see. You can switch at any time.</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { type: 'local', label: '🇧🇩 Local Buyer', desc: 'BDT prices, cart, home delivery in Bangladesh' },
                { type: 'international', label: '🌍 International Buyer', desc: 'USD price ranges, quotation requests, export documentation' },
              ].map(opt => (
                <button key={opt.type} onClick={() => { setBuyerType(opt.type); toast.success(`Switched to ${opt.label}`); }} className={`text-left p-4 rounded-xl border-2 transition-all ${buyerType === opt.type ? 'border-brand bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                  <p className="font-bold text-gray-900 dark:text-white">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

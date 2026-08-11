'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import { Plus, Edit2, Trash2, Zap, Search, Check, Calendar, Clock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// ─── DateTimePicker with explicit OK confirmation button ───────────────────
// Issue 2 (R26): reads/writes real, timezone-aware Date values now — was building a plain
// "YYYY-MM-DDTHH:mm" string with no timezone info at all and sending that straight to the server.
// A string like that gets interpreted as local time IN WHATEVER TIMEZONE PARSES IT, not the
// timezone it was written in — and since this app's server runs in UTC (Vercel's Node runtime)
// while this business operates from Bangladesh (UTC+6), a campaign an admin set to start "right
// now" was actually being stored as 6 hours later than intended, so `startTime <= now` wouldn't
// pass server-side (see the FlashSale queries above) until 6 real hours after it was created —
// exactly why a freshly-created, supposedly-active campaign wouldn't show up on the site at all
// for hours. Fixed by using the browser's own local-time Date constructor when writing
// (interprets the picked y/m/d/h/m in the admin's actual timezone, then normalizes to a proper
// UTC-aware ISO string via toISOString(), which resolves to the same absolute moment no matter
// where it's later parsed) and the Date object's own local getters when reading back for display
// (not slicing the raw ISO string, which is always UTC and would show the wrong time back to an
// admin outside UTC+0).
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toLocalTimeStr(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function DateTimePicker({ label, value, onChange }) {
  const initial = value ? new Date(value) : null;
  const [date, setDate] = useState(initial ? toLocalDateStr(initial) : '');
  const [time, setTime] = useState(initial ? toLocalTimeStr(initial) : '00:00');
  const [confirmed, setConfirmed] = useState(!!value);

  useEffect(() => {
    const d = value ? new Date(value) : null;
    setDate(d ? toLocalDateStr(d) : '');
    setTime(d ? toLocalTimeStr(d) : '00:00');
    setConfirmed(!!value);
  }, [value]);

  const handleConfirm = () => {
    if (!date) { toast.error(`Pick a date for ${label}`); return; }
    const [y, m, day] = date.split('-').map(Number);
    const [hh, mm] = (time || '00:00').split(':').map(Number);
    // new Date(y, m-1, day, hh, mm) interprets these fields as LOCAL time in the browser running
    // this code (the admin's own timezone) — exactly matching what they see in the pickers below.
    onChange(new Date(y, m - 1, day, hh, mm).toISOString());
    setConfirmed(true);
    toast.success(`${label} set ✓`);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label} <span className="text-red-500">*</span></label>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setConfirmed(false); }}
            className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:text-white" />
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input type="time" value={time} onChange={e => { setTime(e.target.value); setConfirmed(false); }}
            className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 dark:text-white" />
        </div>
        <button type="button" onClick={handleConfirm}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${confirmed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'text-white hover:opacity-90'}`}
          style={confirmed ? {} : { backgroundColor: 'var(--color-primary)' }}>
          <Check className="w-4 h-4" />
          {confirmed ? `✓ ${date} at ${time}` : 'OK — Confirm Date & Time'}
        </button>
      </div>
    </div>
  );
}

// ─── Colour picker helper ─────────────────────────────────────────────────
function ColorPicker({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5 bg-white dark:bg-gray-800" />
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder="#hex" className="flex-1 input-field py-2 text-sm font-mono" />
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  title: '', displayName: 'Flash Sale', description: '',
  startTime: '', endTime: '', isActive: true,
  targetAudience: 'all',
  backgroundColor: '#1a1a2e', textColor: '#ffffff',
  badgeText: 'SALE', badgeColor: '#ef4444', badgTextColor: '#ffffff',
  bannerImage: '',
  items: [],
};

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchCampaigns = async () => {
    setLoading(true);
    const r = await fetch('/api/flash-sales?adminView=true');
    const d = await r.json();
    setCampaigns(d.sales || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
    fetch('/api/products?limit=100&adminView=true').then(r => r.json()).then(d => setProducts(d.products || []));
  }, []);

  const filteredProds = products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()));

  const addItem = (product) => {
    if (form.items.find(i => i.product === product._id)) { toast.error('Already added'); return; }
    setForm(p => ({ ...p, items: [...p.items, { product: product._id, productName: product.name, salePrice: product.price || '', discountPercentage: '' }] }));
  };
  const updateItem = (idx, k, v) => setForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], [k]: v }; return { ...p, items }; });
  const removeItem = (idx) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const openNew = () => { setEdit(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (s) => {
    setEdit(s);
    setForm({
      ...EMPTY_FORM, ...s,
      // Pass the real stored value straight through — DateTimePicker itself now converts to/from
      // the admin's own local time correctly (see its own comment). Previously this pre-converted
      // via .toISOString().slice(0,16), which strips the "Z" and leaves a naive UTC-valued string
      // that DateTimePicker would then (correctly, per its own new local-time handling) interpret
      // AS local time — silently reintroducing the same timezone bug on every re-edit.
      startTime: s.startTime || '',
      endTime: s.endTime || '',
      items: (s.items || []).map(i => ({ product: i.product?._id || i.product, productName: i.product?.name || i.productName, salePrice: i.salePrice, discountPercentage: i.discountPercentage })),
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Enter a title'); return; }
    if (!form.startTime) { toast.error('Confirm the Start Time (click OK)'); return; }
    if (!form.endTime) { toast.error('Confirm the End Time (click OK)'); return; }
    if (new Date(form.startTime) >= new Date(form.endTime)) { toast.error('End time must be after start'); return; }
    setSaving(true);
    const url = edit ? `/api/flash-sales/${edit._id}` : '/api/flash-sales';
    const method = edit ? 'PUT' : 'POST';
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items: form.items.map(i => ({ product: i.product, salePrice: Number(i.salePrice), discountPercentage: Number(i.discountPercentage) || 0 })) }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) { toast.success('Campaign saved!'); setModal(false); fetchCampaigns(); }
    else toast.error(d.message);
  };

  const toggleActive = async (c) => {
    await fetch(`/api/flash-sales/${c._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !c.isActive }) });
    fetchCampaigns();
    toast.success(c.isActive ? 'Campaign paused' : 'Campaign activated');
  };

  const isLive = (s) => s.isActive && new Date(s.startTime) <= new Date() && new Date(s.endTime) >= new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
          <p className="text-sm text-gray-500">Flash sales, seasonal offers, special deals — default name is "Flash Sale"</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openNew}>New Campaign</Button>
      </div>

      {loading ? <Loader /> : (
        <div className="space-y-4">
          {campaigns.map(c => (
            <div key={c._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {/* Campaign colour preview */}
                  <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: c.backgroundColor || '#1a1a2e' }}>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: c.badgeColor || '#ef4444', color: c.badgTextColor || '#fff' }}>{c.badgeText || 'SALE'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 dark:text-white">{c.title}</p>
                      {c.displayName && c.displayName !== c.title && <span className="text-xs text-gray-400">({c.displayName})</span>}
                      <Badge variant={isLive(c) ? 'success' : c.isActive ? 'warning' : 'default'}>
                        {isLive(c) ? '🔴 Live' : c.isActive ? 'Scheduled' : 'Inactive'}
                      </Badge>
                      <Badge variant="default" className="text-xs">{c.targetAudience}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.startTime ? format(new Date(c.startTime), 'dd MMM yyyy HH:mm') : '—'} → {c.endTime ? format(new Date(c.endTime), 'dd MMM yyyy HH:mm') : '—'}
                    </p>
                    <p className="text-xs text-gray-400">{c.items?.length || 0} products selected</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(c)} title={c.isActive ? 'Pause' : 'Activate'}
                    className={`p-2 rounded-lg transition-all ${c.isActive ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}>
                    {c.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(c)} className="p-2 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={async () => { if (!confirm('Delete this campaign?')) return; await fetch(`/api/flash-sales/${c._id}`, { method: 'DELETE' }); fetchCampaigns(); toast.success('Deleted'); }}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No campaigns yet — create your first flash sale or seasonal offer</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Campaign' : 'New Campaign'} size="xl"
        footer={<div className="flex gap-3"><Button onClick={handleSave} loading={saving} variant="primary">Save Campaign</Button><Button onClick={() => setModal(false)} variant="ghost">Cancel</Button></div>}>

        <div className="space-y-5">
          {/* ─── Basic info ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Internal Title" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Eid Flash Sale 2026" />
            <Input label="Display Name (on badge & heading)" value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Flash Sale" />
            <Input label="Description (optional)" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Save up to 30% this Eid!" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Audience</label>
              <select value={form.targetAudience} onChange={e => set('targetAudience', e.target.value)} className="input-field">
                <option value="all">All Buyers</option>
                <option value="local">🇧🇩 Local Only</option>
                <option value="international">🌍 International Only</option>
              </select>
            </div>
          </div>

          {/* ─── Branding ─── */}
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">🎨 Campaign Branding</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <ColorPicker label="Section Background" value={form.backgroundColor} onChange={v => set('backgroundColor', v)} />
              <ColorPicker label="Text / Timer Colour" value={form.textColor} onChange={v => set('textColor', v)} />
              <ColorPicker label="Badge Background" value={form.badgeColor} onChange={v => set('badgeColor', v)} />
              <ColorPicker label="Badge Text Colour" value={form.badgTextColor} onChange={v => set('badgTextColor', v)} />
              <div className="md:col-span-2">
                <Input label="Badge Text (e.g. SALE, HOT, EID)" value={form.badgeText} onChange={e => set('badgeText', e.target.value)} placeholder="SALE" />
              </div>
            </div>
            {/* Live preview */}
            <div className="mt-3 rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: form.backgroundColor }}>
              <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: form.badgeColor, color: form.badgTextColor }}>{form.badgeText || 'SALE'}</span>
              <span className="font-bold text-lg" style={{ color: form.textColor }}>{form.displayName || 'Flash Sale'}</span>
              <span className="text-sm opacity-70" style={{ color: form.textColor }}>— Preview</span>
            </div>
          </div>

          {/* ─── Dates ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DateTimePicker label="Start Date & Time" value={form.startTime} onChange={v => set('startTime', v)} />
            <DateTimePicker label="End Date & Time" value={form.endTime} onChange={v => set('endTime', v)} />
          </div>

          {/* ─── Products ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Search & Add Products</p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search products..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} className="input-field pl-9 py-2 text-sm" />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 dark:border-gray-700 rounded-xl p-1">
                {filteredProds.slice(0, 20).map(p => (
                  <button key={p._id} onClick={() => addItem(p)} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between text-gray-700 dark:text-gray-300 transition-colors">
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">৳{p.price}</span>
                  </button>
                ))}
                {filteredProds.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No products found</p>}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Selected ({form.items.length}) — these appear with the <span className="font-bold" style={{ color: form.badgeColor }}>{form.badgeText || 'SALE'}</span> badge
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {form.items.map((item, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{item.productName}</p>
                      <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={item.salePrice} onChange={e => updateItem(i, 'salePrice', e.target.value)} placeholder="Sale Price ৳" className="input-field py-1.5 text-xs" />
                      <input type="number" value={item.discountPercentage} onChange={e => updateItem(i, 'discountPercentage', e.target.value)} placeholder="Discount %" className="input-field py-1.5 text-xs" />
                    </div>
                  </div>
                ))}
                {form.items.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No products added</p>}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <span className="text-sm text-gray-700 dark:text-gray-300">Campaign Active</span>
            <button type="button" onClick={() => set('isActive', !form.isActive)}
              className={`relative w-11 h-6 rounded-full transition-all ${form.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: form.isActive ? '21px' : '2px' }} />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

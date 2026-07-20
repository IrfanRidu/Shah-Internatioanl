'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import { Save, Plus, Trash2, Globe, Palette, Phone, Link2, Upload, Award, Users, Image as ImageIcon } from 'lucide-react';
import { resizeImageFile } from '@/lib/clientImageResize';
import toast from 'react-hot-toast';

// Defined OUTSIDE the page component so React never unmounts/remounts
// it on state changes — prevents input fields losing focus on each keystroke.
function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mb-5">
      <h3 className="font-bold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">{title}</h3>
      {children}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('general');

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).then(d => { setSettings(d.settings || {}); setLoading(false); });
  }, []);

  const set = (path, value) => {
    setSettings(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) { obj[keys[i]] = { ...(obj[keys[i]] || {}) }; obj = obj[keys[i]]; }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    const d = await r.json();
    setSaving(false);
    if (d.success) {
      toast.success('Settings saved! Changes will appear on the site immediately.');
      setSettings(d.settings); // reflect exactly what was persisted
      // Tell every component using useSettings() (Header, Footer, Hero,
      // FAQ, Certifications, Partners, etc.) to refetch right now, instead
      // of waiting for their own next route-change refresh.
      window.dispatchEvent(new CustomEvent('settings-updated'));
    } else toast.error(d.message);
  };

  const handleUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, { maxDimension: 800, quality: 0.85 });
      const res = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, folder: 'branding' }),
      });
      const data = await res.json();
      if (data.success) { set(field, data.url); toast.success('Uploaded!'); }
      else toast.error(data.message || 'Upload failed');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  // Generic helper for uploading into an array item (certifications icon, partner logo)
  const handleArrayItemUpload = async (e, arrayKey, index, itemField) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, { maxDimension: 400, quality: 0.85 });
      const res = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, folder: 'branding' }),
      });
      const data = await res.json();
      if (data.success) {
        const arr = [...(settings[arrayKey] || [])];
        arr[index] = { ...arr[index], [itemField]: data.url };
        set(arrayKey, arr);
        toast.success('Uploaded!');
      } else toast.error(data.message || 'Upload failed');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  if (loading) return <Loader />;

  const tabs = [
    { id: 'general', label: '🏪 General' },
    { id: 'contact', label: '📞 Contact' },
    { id: 'delivery', label: '🚚 Delivery Zones' },
    { id: 'payment', label: '💳 Payment' },
    { id: 'appearance', label: '🎨 Appearance' },
    { id: 'header', label: '🧭 Header' },
    { id: 'footer', label: '🔗 Footer' },
    { id: 'hero', label: '🚀 Hero Stats' },
    { id: 'certifications', label: '🏅 Certifications' },
    { id: 'partners', label: '🤝 Partners' },
    { id: 'faq', label: '❓ FAQ' },
    { id: 'policies', label: '📄 Policies' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <Button variant="primary" icon={Save} onClick={handleSave} loading={saving}>Save Changes</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`} style={tab === t.id ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <Section title="General Settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Site Title" value={settings.siteTitle || ''} onChange={e => set('siteTitle', e.target.value)} />
            <Input label="Tagline" value={settings.siteTagline || ''} onChange={e => set('siteTagline', e.target.value)} />
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Site Description</label>
              <textarea rows={3} value={settings.siteDescription || ''} onChange={e => set('siteDescription', e.target.value)} className="input-field resize-none" /></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Logo</label>
              <div className="flex items-center gap-3">
                {settings.logo && <img src={settings.logo} alt="Logo" className="h-10 object-contain rounded-lg bg-gray-100 p-1" />}
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <Upload className="w-4 h-4" /> Upload Logo
                  <input type="file" accept="image/*" onChange={e => handleUpload(e, 'logo')} className="hidden" />
                </label>
                {settings.logo && <button onClick={() => set('logo', '')} className="text-xs text-red-400 hover:text-red-600">Remove</button>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Favicon</label>
              <div className="flex items-center gap-3">
                {settings.favicon && <img src={settings.favicon} alt="Favicon" className="w-8 h-8 object-contain rounded bg-gray-100 p-1" />}
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <Upload className="w-4 h-4" /> Upload Favicon
                  <input type="file" accept="image/*" onChange={e => handleUpload(e, 'favicon')} className="hidden" />
                </label>
                {settings.favicon && <button onClick={() => set('favicon', '')} className="text-xs text-red-400 hover:text-red-600">Remove</button>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Active Language</label>
              <select value={settings.activeLanguage || 'en'} onChange={e => set('activeLanguage', e.target.value)} className="input-field">
                <option value="en">English</option><option value="bn">বাংলা</option>
              </select>
            </div>
            <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div><p className="font-medium text-red-800 dark:text-red-400 text-sm">Maintenance Mode</p><p className="text-xs text-red-600 dark:text-red-300">Visitors see maintenance page</p></div>
              <button onClick={() => set('maintenanceMode', !settings.maintenanceMode)} className={`relative w-11 h-6 rounded-full transition-all ${settings.maintenanceMode ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: settings.maintenanceMode ? '21px' : '2px' }} />
              </button>
            </div>
          </div>
        </Section>
      )}

      {tab === 'contact' && (
        <Section title="Contact Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Phone" value={settings.contact?.phone || ''} onChange={e => set('contact.phone', e.target.value)} placeholder="+880 1700-000000" />
            <Input label="WhatsApp" value={settings.contact?.whatsapp || ''} onChange={e => set('contact.whatsapp', e.target.value)} placeholder="+880 1700-000000" />
            <Input label="General Email" value={settings.contact?.email || ''} onChange={e => set('contact.email', e.target.value)} placeholder="info@shahintl.com" />
            <Input label="Export Email" value={settings.contact?.exportEmail || ''} onChange={e => set('contact.exportEmail', e.target.value)} placeholder="export@shahintl.com" />
            <div className="md:col-span-2"><Input label="Address" value={settings.contact?.address || ''} onChange={e => set('contact.address', e.target.value)} placeholder="Dhaka, Bangladesh" /></div>
            <Input label="Facebook" value={settings.social?.facebook || ''} onChange={e => set('social.facebook', e.target.value)} placeholder="https://facebook.com/..." />
            <Input label="Instagram" value={settings.social?.instagram || ''} onChange={e => set('social.instagram', e.target.value)} placeholder="https://instagram.com/..." />
            <Input label="LinkedIn" value={settings.social?.linkedin || ''} onChange={e => set('social.linkedin', e.target.value)} placeholder="https://linkedin.com/..." />
            <Input label="YouTube" value={settings.social?.youtube || ''} onChange={e => set('social.youtube', e.target.value)} placeholder="https://youtube.com/..." />
          </div>
        </Section>
      )}

      {tab === 'delivery' && (
        <>
          <Section title="🚚 Delivery Zones">
            <p className="text-sm text-gray-500 mb-4">Add zones with different charges. Buyers select their zone at checkout.</p>
            <div className="space-y-3 mb-4">
              {(settings.deliveryZones || []).map((zone, zi) => (
                <div key={zi} className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <input value={zone.name} onChange={e => { const z=[...(settings.deliveryZones||[])]; z[zi]={...z[zi],name:e.target.value}; set('deliveryZones',z); }} placeholder="Zone (e.g. Dhaka City)" className="input-field py-2 text-sm col-span-2 md:col-span-1" />
                  <input type="number" value={zone.charge} onChange={e => { const z=[...(settings.deliveryZones||[])]; z[zi]={...z[zi],charge:Number(e.target.value)}; set('deliveryZones',z); }} placeholder="Charge ৳" className="input-field py-2 text-sm" />
                  <input type="number" value={zone.freeAbove||''} onChange={e => { const z=[...(settings.deliveryZones||[])]; z[zi]={...z[zi],freeAbove:Number(e.target.value)}; set('deliveryZones',z); }} placeholder="Free above ৳" className="input-field py-2 text-sm" />
                  <input value={zone.estimatedDays||''} onChange={e => { const z=[...(settings.deliveryZones||[])]; z[zi]={...z[zi],estimatedDays:e.target.value}; set('deliveryZones',z); }} placeholder="e.g. 1-2 days" className="input-field py-2 text-sm" />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                      <input type="checkbox" checked={zone.isActive!==false} onChange={e => { const z=[...(settings.deliveryZones||[])]; z[zi]={...z[zi],isActive:e.target.checked}; set('deliveryZones',z); }} className="accent-green-600 w-3.5 h-3.5" /> Active
                    </label>
                    <button onClick={() => set('deliveryZones',(settings.deliveryZones||[]).filter((_,j)=>j!==zi))} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors flex-shrink-0">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => set('deliveryZones',[...(settings.deliveryZones||[]),{name:'',charge:60,freeAbove:0,estimatedDays:'',isActive:true}])} className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand hover:text-brand transition-all">
              <Plus className="w-4 h-4" /> Add Zone
            </button>
          </Section>
          <Section title="Fallback / Default Pricing">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Default Delivery Charge (৳)" type="number" value={settings.localDeliveryCharge||''} onChange={e => set('localDeliveryCharge',Number(e.target.value))} placeholder="60" />
              <Input label="Free Delivery Above (৳)" type="number" value={settings.freeDeliveryAbove||''} onChange={e => set('freeDeliveryAbove',Number(e.target.value))} placeholder="1000" />
              <Input label="VAT (%)" type="number" value={settings.vatPercentage||''} onChange={e => set('vatPercentage',Number(e.target.value))} placeholder="0" />
            </div>
          </Section>
        </>
      )}

      {tab === 'payment' && (
        <>
          <Section title="💳 bKash / Nagad Merchant Numbers">
            <p className="text-sm text-gray-500 mb-4">
              Customers see this number at checkout and manually "Send Money" to it, then submit their Transaction ID (TrxID) and the phone number they paid from. You verify the transaction in your bKash/Nagad merchant app before confirming the order — this is the standard flow used by Bangladeshi stores that don't have a direct bKash/Nagad Merchant API integration.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="bKash Number"
                value={settings.payment?.bkashNumber || ''}
                onChange={e => set('payment', { ...(settings.payment || {}), bkashNumber: e.target.value })}
                placeholder="01XXXXXXXXX"
              />
              <Input
                label="Nagad Number"
                value={settings.payment?.nagadNumber || ''}
                onChange={e => set('payment', { ...(settings.payment || {}), nagadNumber: e.target.value })}
                placeholder="01XXXXXXXXX"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">Leave a field empty to hide that payment option at checkout.</p>
          </Section>

          <Section title="🚚 Cash on Delivery — Delivery Charge Prepayment">
            <div className="flex items-start justify-between gap-4 bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">Require delivery charge to be paid online for COD orders</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  When <b>ON</b>, customers choosing Cash on Delivery must pay just the delivery fee upfront via card (Stripe) before their order can be placed — the product cost itself is still collected in cash at the door.
                  When <b>OFF</b> (default), COD orders require no upfront payment at all.
                </p>
              </div>
              <button
                type="button"
                onClick={() => set('payment', { ...(settings.payment || {}), codDeliveryChargeRequired: !settings.payment?.codDeliveryChargeRequired })}
                className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 ${settings.payment?.codDeliveryChargeRequired ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: settings.payment?.codDeliveryChargeRequired ? '25px' : '2px' }} />
              </button>
            </div>
          </Section>
        </>
      )}

      {tab === 'hero' && (
        <Section title="🚀 Homepage Hero Stats">
          <p className="text-sm text-gray-500 mb-4">
            The four counters shown on the homepage (e.g. "35+ Countries"). Enter the value including any suffix (e.g. "35+", "120+", "8"). Leave empty to use the built-in defaults.
          </p>
          <div className="space-y-3 mb-4">
            {(settings.heroStats?.length ? settings.heroStats : [{ label: 'Countries', value: '35+' }, { label: 'Products', value: '120+' }, { label: 'Years', value: '15+' }, { label: 'Certifications', value: '8' }]).map((stat, si) => (
              <div key={si} className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 items-center">
                <input
                  value={stat.label}
                  onChange={e => { const s = [...(settings.heroStats?.length ? settings.heroStats : [{ label: 'Countries', value: '35+' }, { label: 'Products', value: '120+' }, { label: 'Years', value: '15+' }, { label: 'Certifications', value: '8' }])]; s[si] = { ...s[si], label: e.target.value }; set('heroStats', s); }}
                  placeholder="Label (e.g. Countries)"
                  className="input-field py-2 text-sm"
                />
                <div className="flex items-center gap-2">
                  <input
                    value={stat.value}
                    onChange={e => { const s = [...(settings.heroStats?.length ? settings.heroStats : [{ label: 'Countries', value: '35+' }, { label: 'Products', value: '120+' }, { label: 'Years', value: '15+' }, { label: 'Certifications', value: '8' }])]; s[si] = { ...s[si], value: e.target.value }; set('heroStats', s); }}
                    placeholder="Value (e.g. 35+)"
                    className="input-field py-2 text-sm flex-1"
                  />
                  <button onClick={() => set('heroStats', (settings.heroStats?.length ? settings.heroStats : []).filter((_, j) => j !== si))} className="p-2 text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => set('heroStats', [...(settings.heroStats?.length ? settings.heroStats : [{ label: 'Countries', value: '35+' }, { label: 'Products', value: '120+' }, { label: 'Years', value: '15+' }, { label: 'Certifications', value: '8' }]), { label: '', value: '' }])} className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand hover:text-brand transition-all">
            <Plus className="w-4 h-4" /> Add Stat
          </button>
        </Section>
      )}

      {tab === 'certifications' && (
        <Section title="🏅 Certifications & Compliance">
          <p className="text-sm text-gray-500 mb-4">Certification badges shown on the homepage (e.g. HACCP, ISO, Organic). Upload an icon/logo for each.</p>
          <div className="space-y-3 mb-4">
            {(settings.certifications || []).map((cert, ci) => (
              <div key={ci} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <label className="flex-shrink-0 cursor-pointer">
                  {cert.icon
                    ? <img src={cert.icon} alt={cert.name} className="w-12 h-12 rounded-xl object-contain bg-white border border-gray-200 p-1" />
                    : <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 transition-colors"><Upload className="w-4 h-4 text-gray-400" /></div>
                  }
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleArrayItemUpload(e, 'certifications', ci, 'icon')} />
                </label>
                <div className="flex-1 space-y-2">
                  <input value={cert.name || ''} onChange={e => { const c = [...(settings.certifications || [])]; c[ci] = { ...c[ci], name: e.target.value }; set('certifications', c); }} placeholder="Certification name (e.g. HACCP Certified)" className="input-field py-2 text-sm w-full" />
                  <input value={cert.description || ''} onChange={e => { const c = [...(settings.certifications || [])]; c[ci] = { ...c[ci], description: e.target.value }; set('certifications', c); }} placeholder="Short description" className="input-field py-2 text-sm w-full" />
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" checked={cert.isActive !== false} onChange={e => { const c = [...(settings.certifications || [])]; c[ci] = { ...c[ci], isActive: e.target.checked }; set('certifications', c); }} className="accent-green-600 w-3.5 h-3.5" /> Show
                  </label>
                  <button onClick={() => set('certifications', (settings.certifications || []).filter((_, j) => j !== ci))} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors">✕ Remove</button>
                </div>
              </div>
            ))}
            {(settings.certifications || []).length === 0 && <p className="text-sm text-gray-400 italic">No certifications added yet.</p>}
          </div>
          <button onClick={() => set('certifications', [...(settings.certifications || []), { name: '', description: '', icon: '', order: (settings.certifications || []).length, isActive: true }])} className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand hover:text-brand transition-all">
            <Plus className="w-4 h-4" /> Add Certification
          </button>
        </Section>
      )}

      {tab === 'partners' && (
        <Section title="🤝 Our Partners / Buyers">
          <p className="text-sm text-gray-500 mb-4">Company logos shown in the auto-scrolling "Our Partners" section on the homepage, before the reviews section.</p>
          <div className="space-y-3 mb-4">
            {(settings.partners || []).map((partner, pi) => (
              <div key={pi} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <label className="flex-shrink-0 cursor-pointer">
                  {partner.logo
                    ? <img src={partner.logo} alt={partner.name} className="w-16 h-12 rounded-xl object-contain bg-white border border-gray-200 p-1" />
                    : <div className="w-16 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 transition-colors"><Upload className="w-4 h-4 text-gray-400" /></div>
                  }
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleArrayItemUpload(e, 'partners', pi, 'logo')} />
                </label>
                <div className="flex-1 space-y-2">
                  <input value={partner.name || ''} onChange={e => { const p = [...(settings.partners || [])]; p[pi] = { ...p[pi], name: e.target.value }; set('partners', p); }} placeholder="Company name" className="input-field py-2 text-sm w-full" />
                  <input value={partner.website || ''} onChange={e => { const p = [...(settings.partners || [])]; p[pi] = { ...p[pi], website: e.target.value }; set('partners', p); }} placeholder="Website (optional)" className="input-field py-2 text-sm w-full" />
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" checked={partner.isActive !== false} onChange={e => { const p = [...(settings.partners || [])]; p[pi] = { ...p[pi], isActive: e.target.checked }; set('partners', p); }} className="accent-green-600 w-3.5 h-3.5" /> Show
                  </label>
                  <button onClick={() => set('partners', (settings.partners || []).filter((_, j) => j !== pi))} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors">✕ Remove</button>
                </div>
              </div>
            ))}
            {(settings.partners || []).length === 0 && <p className="text-sm text-gray-400 italic">No partners added yet.</p>}
          </div>
          <button onClick={() => set('partners', [...(settings.partners || []), { name: '', logo: '', website: '', order: (settings.partners || []).length, isActive: true }])} className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand hover:text-brand transition-all">
            <Plus className="w-4 h-4" /> Add Partner
          </button>
        </Section>
      )}

      {tab === 'faq' && (
        <Section title="❓ FAQ Section">
          <p className="text-sm text-gray-500 mb-4">Questions displayed on the shop homepage. Click a question to show the answer (hover or click).</p>
          <div className="space-y-3 mb-4">
            {(settings.faqs || []).map((faq, fi) => (
              <div key={fi} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <input value={faq.question} onChange={e => { const f=[...(settings.faqs||[])]; f[fi]={...f[fi],question:e.target.value}; set('faqs',f); }} placeholder="Question..." className="input-field py-2 text-sm w-full" />
                    <textarea rows={2} value={faq.answer} onChange={e => { const f=[...(settings.faqs||[])]; f[fi]={...f[fi],answer:e.target.value}; set('faqs',f); }} placeholder="Answer..." className="input-field resize-none text-sm w-full" />
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input type="checkbox" checked={faq.isActive!==false} onChange={e => { const f=[...(settings.faqs||[])]; f[fi]={...f[fi],isActive:e.target.checked}; set('faqs',f); }} className="accent-green-600 w-3.5 h-3.5" /> Show
                    </label>
                    <button onClick={() => set('faqs',(settings.faqs||[]).filter((_,j)=>j!==fi))} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors">✕ Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => set('faqs',[...(settings.faqs||[]),{question:'',answer:'',order:(settings.faqs||[]).length,isActive:true}])} className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand hover:text-brand transition-all">
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </Section>
      )}

      {tab === 'appearance' && (
        <Section title="Theme & Appearance">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[{ id: 'green', label: 'Forest Green', color: '#2d6a4f' }, { id: 'dark', label: 'Dark Mode', color: '#1a1a2e' }, { id: 'earth', label: 'Earth Tone', color: '#6b4226' }, { id: 'ocean', label: 'Ocean Blue', color: '#0077b6' }].map(t => (
              <button key={t.id} onClick={() => set('activeTheme', t.id)} className={`p-4 rounded-2xl border-2 text-center transition-all ${settings.activeTheme === t.id ? 'border-brand ring-2 ring-brand/30' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="w-10 h-10 rounded-full mx-auto mb-2" style={{ backgroundColor: t.color }} />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.label}</p>
                {settings.activeTheme === t.id && <p className="text-xs text-brand mt-1">✓ Active</p>}
              </button>
            ))}
          </div>
        </Section>
      )}

      {tab === 'header' && (
        <Section title="Header Navigation Links">
          <p className="text-sm text-gray-500 mb-4">
            Add custom links to the main site navigation, shown alongside Home / Products / Categories in the header.
          </p>
          {(settings.headerLinks || []).length === 0 && (
            <p className="text-sm text-gray-400 italic mb-4">No custom header links yet — only the default Home / Products / Categories links are shown.</p>
          )}
          <div className="space-y-2 mb-3">
            {(settings.headerLinks || []).map((link, li) => (
              <div key={li} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <input
                  value={link.title}
                  onChange={e => { const l = [...(settings.headerLinks || [])]; l[li] = { ...l[li], title: e.target.value }; set('headerLinks', l); }}
                  placeholder="Link title (e.g. About Us)"
                  className="input-field py-2 text-sm flex-1"
                />
                <input
                  value={link.url}
                  onChange={e => { const l = [...(settings.headerLinks || [])]; l[li] = { ...l[li], url: e.target.value }; set('headerLinks', l); }}
                  placeholder="/about or https://..."
                  className="input-field py-2 text-sm flex-1"
                />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0 px-2">
                  <input
                    type="checkbox"
                    checked={!!link.isExternal}
                    onChange={e => { const l = [...(settings.headerLinks || [])]; l[li] = { ...l[li], isExternal: e.target.checked }; set('headerLinks', l); }}
                    className="w-3.5 h-3.5 accent-green-600"
                  />
                  New tab
                </label>
                <button onClick={() => { const l = (settings.headerLinks || []).filter((_, i) => i !== li); set('headerLinks', l); }} className="p-2 text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => set('headerLinks', [...(settings.headerLinks || []), { title: '', url: '', isExternal: false }])} className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-brand hover:text-brand transition-all text-sm">
            <Plus className="w-4 h-4" /> Add Header Link
          </button>
        </Section>
      )}

      {tab === 'footer' && (
        <Section title="Footer Links">
          <p className="text-sm text-gray-500 mb-4">Add sections and links for the website footer</p>
          {(settings.footerSections || []).map((section, si) => (
            <div key={si} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <input value={section.title} onChange={e => { const s = [...(settings.footerSections || [])]; s[si] = { ...s[si], title: e.target.value }; set('footerSections', s); }} placeholder="Section Title" className="input-field py-2 text-sm flex-1" />
                <button onClick={() => { const s = (settings.footerSections || []).filter((_, i) => i !== si); set('footerSections', s); }} className="p-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
              {(section.links || []).map((link, li) => (
                <div key={li} className="flex gap-2 mb-2">
                  <input value={link.title} onChange={e => { const s = [...(settings.footerSections || [])]; s[si].links[li] = { ...s[si].links[li], title: e.target.value }; set('footerSections', s); }} placeholder="Link title" className="input-field py-1.5 text-sm flex-1" />
                  <input value={link.url} onChange={e => { const s = [...(settings.footerSections || [])]; s[si].links[li] = { ...s[si].links[li], url: e.target.value }; set('footerSections', s); }} placeholder="/url" className="input-field py-1.5 text-sm flex-1" />
                  <button onClick={() => { const s = [...(settings.footerSections || [])]; s[si].links = s[si].links.filter((_, i) => i !== li); set('footerSections', s); }} className="p-1.5 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => { const s = [...(settings.footerSections || [])]; s[si].links = [...(s[si].links || []), { title: '', url: '' }]; set('footerSections', s); }} className="flex items-center gap-1 text-xs text-brand hover:underline mt-1"><Plus className="w-3 h-3" /> Add Link</button>
            </div>
          ))}
          <button onClick={() => set('footerSections', [...(settings.footerSections || []), { title: '', links: [] }])} className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-brand hover:text-brand transition-all text-sm mt-2"><Plus className="w-4 h-4" /> Add Section</button>
        </Section>
      )}

      {tab === 'policies' && (
        <>
          {[{ key: 'aboutUs', label: 'About Us' }, { key: 'termsAndConditions', label: 'Terms & Conditions' }, { key: 'privacyPolicy', label: 'Privacy Policy' }, { key: 'refundPolicy', label: 'Refund Policy' }, { key: 'shippingPolicy', label: 'Shipping Policy' }].map(({ key, label }) => (
            <Section key={key} title={label}>
              <textarea rows={6} value={settings[key] || ''} onChange={e => set(key, e.target.value)} className="input-field resize-y" placeholder={`Enter ${label} content...`} />
            </Section>
          ))}
        </>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import { Mail, Users, Send, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminMarketingPage() {
  const [form, setForm] = useState({ subject: '', body: '', audience: 'all' });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [userCount, setUserCount] = useState({ all: 0, local: 0, international: 0 });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([
      fetch('/api/users?limit=1').then(r => r.json()),
      fetch('/api/users?buyerType=local&limit=1').then(r => r.json()),
      fetch('/api/users?buyerType=international&limit=1').then(r => r.json()),
    ]).then(([all, local, intl]) => {
      setUserCount({ all: all.total || 0, local: local.total || 0, international: intl.total || 0 });
    }).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!form.subject || !form.body) { toast.error('Subject and body required'); return; }
    if (!confirm(`Send email to ${userCount[form.audience]} customers?`)) return;
    setSending(true);
    const res = await fetch('/api/admin/send-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    setSending(false);
    if (data.success) { setResult(data); toast.success(`Sent to ${data.sent} customers!`); }
    else toast.error(data.message);
  };

  const TEMPLATES = [
    { label: 'Flash Sale', subject: '⚡ 48-Hour Flash Sale – Up to 30% OFF!', body: 'Hi {{name}},\n\nDon\'t miss our exclusive 48-hour flash sale on selected fresh produce!\n\nShop now at shahintl.com\n\nBest,\nShah International Team' },
    { label: 'New Arrivals', subject: '🌿 New Arrivals – Fresh Seasonal Products!', body: 'Hi {{name}},\n\nExciting news! We have added new seasonal products to our collection.\n\nVisit shahintl.com to browse.\n\nShah International Team' },
    { label: 'Restock Alert', subject: '📦 Back in Stock – Your Favourites Return!', body: 'Hi {{name}},\n\nGreat news! Some of your favourite products are back in stock.\n\nOrder now before they sell out!\n\nShah International Team' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Marketing</h1><p className="text-sm text-gray-500">Send bulk emails to your customers</p></div>
      </div>

      {/* Audience stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[{ key: 'all', label: 'All Customers', icon: '👥', color: 'bg-gray-50' }, { key: 'local', label: 'Local Buyers', icon: '🇧🇩', color: 'bg-green-50' }, { key: 'international', label: 'Importers', icon: '🌍', color: 'bg-blue-50' }].map(({ key, label, icon, color }) => (
          <button key={key} onClick={() => set('audience', key)} className={`p-4 rounded-2xl border-2 text-left transition-all ${form.audience === key ? 'border-brand' : 'border-gray-200'} ${color}`}>
            <div className="text-2xl mb-1">{icon}</div>
            <p className="text-xl font-bold text-gray-900">{userCount[key]}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2"><Mail className="w-4 h-4 text-brand" /> Compose Email</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subject Line</label>
              <input type="text" value={form.subject} onChange={e => set('subject', e.target.value)} className="input-field" placeholder="Your compelling subject line..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Body <span className="text-gray-400 font-normal">(use {'{'}{'{'}{'}'}name{'}'}{'}'}  for personalization)</span></label>
              <textarea rows={10} value={form.body} onChange={e => set('body', e.target.value)} className="input-field resize-y font-mono text-sm" placeholder="Hi {{name}},&#10;&#10;Your email content here..." />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSend} loading={sending} variant="primary" icon={Send}>
                Send to {userCount[form.audience]} {form.audience === 'all' ? 'Customers' : form.audience === 'local' ? 'Local Buyers' : 'Importers'}
              </Button>
              <Button onClick={() => { setForm({ subject: '', body: '', audience: form.audience }); setResult(null); }} variant="ghost">Clear</Button>
            </div>
            {result && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl p-4 text-sm">
                <p className="font-semibold text-green-800 dark:text-green-400">✅ Campaign sent!</p>
                <p className="text-green-600 dark:text-green-300">Delivered: {result.sent} · Failed: {result.failed} · Total: {result.total}</p>
              </div>
            )}
          </div>
        </div>

        {/* Templates */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">Quick Templates</h2>
          <div className="space-y-3">
            {TEMPLATES.map(tmpl => (
              <button key={tmpl.label} onClick={() => { set('subject', tmpl.subject); set('body', tmpl.body); }} className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">
                <p className="font-semibold text-gray-800 dark:text-white text-sm mb-1">{tmpl.label}</p>
                <p className="text-xs text-gray-500 truncate">{tmpl.subject}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1">⚠️ Important</p>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <li>• Emails sent in batches of 10</li>
              <li>• Use {'{{name}}'} for personalization</li>
              <li>• Test with small audience first</li>
              <li>• Respect customer opt-in preferences</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

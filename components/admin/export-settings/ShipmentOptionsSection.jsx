'use client';
import { useState, useEffect } from 'react';
import { Plus, X, Save } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import toast from 'react-hot-toast';

const FIELDS = [
  { key: 'modeOfCarrying', label: 'Mode of Carrying' },
  { key: 'landingPort', label: 'Landing Port' },
  { key: 'portOfDischarge', label: 'Port of Discharge' },
  { key: 'finalDestination', label: 'Final Destination' },
  { key: 'salesTerm', label: 'Sales Terms' },
  { key: 'countryOfOrigin', label: 'Country of Origin' },
];

// A single "type a value, press Enter or click Add, click a chip's × to remove" list editor —
// requirement 5's 6 fields all need the exact same interaction, just against a different key of
// the shared options object, so this is one small reusable piece instead of 6 near-duplicates.
function TagListEditor({ label, values, onChange }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) { setDraft(''); return; }
    onChange([...values, v]);
    setDraft('');
  };
  const remove = (v) => onChange(values.filter(x => x !== v));
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
      <p className="font-semibold text-gray-900 dark:text-white mb-3">{label}</p>
      <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
        {values.length === 0 && <p className="text-xs text-gray-400 italic">No options added yet</p>}
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-brand px-2.5 py-1 rounded-lg">
            {v}
            <button type="button" onClick={() => remove(v)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={`Add a ${label.toLowerCase()} option…`}
          className="input-field text-sm flex-1"
        />
        <Button variant="secondary" icon={Plus} onClick={add}>Add</Button>
      </div>
    </div>
  );
}

export default function ShipmentOptionsSection() {
  const [options, setOptions] = useState(null); // null while loading
  const [saving, setSaving] = useState(false);

  const fetchOptions = async () => {
    const r = await fetch('/api/settings');
    const d = await r.json();
    const opts = d?.settings?.exportShipmentOptions || {};
    setOptions({
      modeOfCarrying: opts.modeOfCarrying || [],
      landingPort: opts.landingPort || [],
      portOfDischarge: opts.portOfDischarge || [],
      finalDestination: opts.finalDestination || [],
      salesTerm: opts.salesTerm || [],
      countryOfOrigin: opts.countryOfOrigin || [],
    });
  };
  useEffect(() => { fetchOptions(); }, []);

  const setField = (key, values) => setOptions(p => ({ ...p, [key]: values }));

  const handleSave = async () => {
    setSaving(true);
    // The full 6-field object is always sent together (never just one changed field) — the PUT
    // route flattens it to per-list dot-notation paths (exportShipmentOptions.modeOfCarrying, etc.)
    // so each list is set explicitly and independently, see app/api/settings/route.js.
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exportShipmentOptions: options }) });
    const d = await r.json();
    setSaving(false);
    if (d.success) {
      // Re-sync from what the server actually persisted, rather than trusting our own pre-save
      // local state — makes any future save/read discrepancy visible immediately here, instead of
      // only being discoverable later after a page refresh.
      const saved = d.settings?.exportShipmentOptions || {};
      setOptions({
        modeOfCarrying: saved.modeOfCarrying || [],
        landingPort: saved.landingPort || [],
        portOfDischarge: saved.portOfDischarge || [],
        finalDestination: saved.finalDestination || [],
        salesTerm: saved.salesTerm || [],
        countryOfOrigin: saved.countryOfOrigin || [],
      });
      toast.success('Shipment configuration saved!');
    } else {
      toast.error(d.message || 'Failed to save');
    }
  };

  if (!options) return <Loader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">Shipment Configuration</h2>
          <p className="text-sm text-gray-400">Preset option lists suggested in every shipment's Shipment Details tab.</p>
        </div>
        <Button variant="primary" icon={Save} onClick={handleSave} loading={saving}>Save Changes</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(f => (
          <TagListEditor key={f.key} label={f.label} values={options[f.key]} onChange={v => setField(f.key, v)} />
        ))}
      </div>
    </div>
  );
}

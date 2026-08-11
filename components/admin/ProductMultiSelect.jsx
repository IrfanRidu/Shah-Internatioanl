'use client';
import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Issue 7: "Admin will search product and the all the products will be suggested to pick" — a
// search-as-you-type box that suggests catalog matches immediately on focus (same UX as the
// existing single-select ProductNameCombobox), but here selecting a suggestion ADDS it to a list
// instead of replacing a single value, and already-picked products show as removable chips.
//
// value: array of { _id, name } — kept as pairs (not just IDs) so the caller never needs a
// separate lookup to render chips, which matters for the edit flow where the coupon API already
// returns populated { _id, name } objects for applicableProducts.
export default function ProductMultiSelect({ value = [], onChange, placeholder = 'Search products to add…' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const search = (q) => {
    setLoading(true);
    fetch(`/api/products?search=${encodeURIComponent(q || '')}&limit=8`)
      .then(r => r.json())
      .then(d => setResults(d.products || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  const handleFocus = () => {
    setOpen(true);
    if (!results.length) search(query);
  };

  const handleChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 250);
  };

  const selectedIds = new Set(value.map(v => String(v._id)));

  const addProduct = (p) => {
    if (selectedIds.has(String(p._id))) return; // already picked
    onChange([...value, { _id: p._id, name: p.name }]);
    setQuery('');
    setOpen(false);
  };

  const removeProduct = (id) => {
    onChange(value.filter(v => String(v._id) !== String(id)));
  };

  return (
    <div ref={ref} className="relative">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(p => (
            <span key={p._id} className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-brand px-2 py-1 rounded-lg">
              {p.name}
              <button type="button" onClick={() => removeProduct(p._id)} className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        className="input-field text-sm w-full"
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-30 max-h-52 overflow-y-auto">
          {loading && <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>}
          {!loading && results.map(p => {
            const already = selectedIds.has(String(p._id));
            return (
              <button
                key={p._id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addProduct(p)}
                disabled={already}
                className={`w-full text-left px-3 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors ${already ? 'opacity-40 cursor-default' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <p className="text-xs font-medium text-gray-900 dark:text-white">{p.name}{already ? ' (added)' : ''}</p>
                {(p.scientificName || p.localName) && (
                  <p className="text-[10px] text-gray-400 italic">
                    {[p.scientificName, p.localName].filter(Boolean).join(' · ')}
                  </p>
                )}
              </button>
            );
          })}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">No matching products.</p>
          )}
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect, useRef } from 'react';

// Reusable searchable/typeable product-name field (issue 37): lets the admin either free-type any
// text (never locked to the catalog) OR pick from the product catalog via a dropdown that appears on
// focus (showing catalog matches right away) and narrows as they type. Selecting a suggestion calls
// `onSelect` with the FULL product document, so the caller can also auto-fill related fields — e.g.
// the botanical/scientific name that was entered for that product back when it was first listed.
export default function ProductNameCombobox({ value, onChange, onSelect, placeholder = 'Product name', className = '' }) {
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
    // Show suggestions right away even before typing anything, so admins can browse the catalog from
    // a blank/existing field, not just type-to-search.
    if (!results.length) search(value || '');
  };

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 250);
  };

  return (
    <div ref={ref} className="relative">
      <input
        value={value || ''}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        className={className || 'input-field py-1 text-xs w-full'}
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-30 max-h-52 overflow-y-auto min-w-[220px]">
          {loading && <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>}
          {!loading && results.map(p => (
            <button
              key={p._id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(p); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
            >
              <p className="text-xs font-medium text-gray-900 dark:text-white">{p.name}</p>
              {p.scientificName && <p className="text-[10px] text-gray-400 italic">{p.scientificName}</p>}
            </button>
          ))}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">No catalog match — you can still type a custom name.</p>
          )}
        </div>
      )}
    </div>
  );
}

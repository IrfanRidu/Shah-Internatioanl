'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Leaf } from 'lucide-react';

// Reusable searchable/typeable product-name field (issue 37): lets the admin either free-type any
// text (never locked to the catalog) OR pick from the product catalog via a dropdown that appears on
// focus (showing catalog matches right away) and narrows as they type. Selecting a suggestion calls
// `onSelect` with the FULL product document, so the caller can also auto-fill related fields — e.g.
// the botanical/scientific name that was entered for that product back when it was first listed.
//
// Batch 7 round 2: this is used inside the Shipment Details product table, which sits inside an
// `overflow-x-auto` wrapper (needed so the wide table can scroll horizontally on smaller screens).
// A plain `position: absolute` dropdown was getting clipped by that same wrapper — per the CSS spec,
// setting overflow-x to anything other than `visible` forces overflow-y to compute as `auto` too, so
// the browser was clipping the dropdown vertically right along with any horizontal table overflow,
// regardless of z-index (z-index only resolves stacking order between siblings; it cannot escape an
// ancestor's overflow clipping). Rendering the dropdown through a portal into document.body — the
// standard fix for "dropdown trapped inside a scrollable/clipped ancestor" used by essentially every
// serious combobox implementation — sidesteps this entirely: it's positioned via the real input's
// on-screen coordinates (getBoundingClientRect), independent of where it sits in the component tree.
export default function ProductNameCombobox({ value, onChange, onSelect, placeholder = 'Product name', className = '' }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null); // {top, left, width} in viewport px, for the portal
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const requestSeqRef = useRef(0); // guards against an older/slower response overwriting a newer one

  // document.body only exists client-side — avoids an SSR/hydration mismatch from calling
  // createPortal before the browser DOM is available.
  useEffect(() => { setMounted(true); }, []);

  // The portal renders the dropdown in a completely different part of the DOM tree than the input,
  // so a single "click outside this ref" check can't cover both halves — check against whichever of
  // the two (or both) actually exist.
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Keep the portal glued to the real input's on-screen position — recomputed whenever it opens, and
  // kept in sync while open against ANY scrolling (the table's own horizontal scrollbar included,
  // via the capture-phase listener below) or window resize, since `position: fixed` tracks the
  // viewport, not whichever ancestor happens to be scrolling.
  useEffect(() => {
    if (!open) return;
    const updateCoords = () => {
      if (!inputRef.current) return;
      const r = inputRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom, left: r.left, width: r.width });
    };
    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open]);

  const search = (q) => {
    setLoading(true);
    const mySeq = ++requestSeqRef.current;
    // A blank q (browsing before typing anything) intentionally omits the search param entirely
    // rather than sending search= with an empty value — cleaner on the wire, and avoids any
    // ambiguity server-side about how an explicitly-empty-but-present param should be treated.
    const qs = q ? `search=${encodeURIComponent(q)}&limit=8` : `limit=15`;
    fetch(`/api/products?${qs}`)
      .then(r => r.json())
      .then(d => { if (requestSeqRef.current === mySeq) setResults(d.products || []); })
      .catch(() => { if (requestSeqRef.current === mySeq) setResults([]); })
      .finally(() => { if (requestSeqRef.current === mySeq) setLoading(false); });
  };

  const handleFocus = () => {
    setOpen(true);
    // Always fetch fresh on focus rather than reusing whatever's already in `results` — cheap, and
    // guarantees a transient failure or stale state from an earlier interaction never leaves the
    // dropdown stuck showing "No catalog match" on a later focus when the catalog genuinely does
    // have matches.
    search(value || '');
  };

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 250);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        value={value || ''}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        className={className || 'input-field py-1 text-xs w-full'}
      />
      {mounted && open && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.top + 4, left: coords.left, width: Math.max(coords.width, 240), zIndex: 9999 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-56 overflow-y-auto"
        >
          {loading && <p className="px-3 py-2.5 text-xs text-gray-400">Searching…</p>}
          {!loading && results.map((p) => (
            <button
              key={p._id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(p); setOpen(false); }}
              className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
            >
              {/* Issue 4: a thumbnail makes it much faster to confirm this is the right product when
                  several share a similar name — matches the header search box's own autocomplete
                  pattern (components/ui/SearchAutocomplete.jsx). */}
              <span className="relative w-8 h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                {p.images?.[0]
                  ? <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="32px" />
                  : <Leaf className="w-4 h-4 m-2 text-gray-300" />}
              </span>
              <span className="min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                {(p.scientificName || p.localName) && (
                  <p className="text-[10px] text-gray-400 italic truncate">
                    {[p.scientificName, p.localName].filter(Boolean).join(' · ')}
                  </p>
                )}
              </span>
            </button>
          ))}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-gray-400">No catalog match — you can still type a custom name.</p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

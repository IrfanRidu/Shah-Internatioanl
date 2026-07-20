'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, X, Loader2, TrendingUp } from 'lucide-react';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useCurrency } from '@/contexts/CurrencyContext';

const POPULAR = ['Bitter Gourd', 'Turmeric Root', 'Alphonso Mango', 'Fresh Ginger', 'Snake Gourd'];

export default function SearchAutocomplete({ placeholder = 'Search products...', className = '' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const router = useRouter();
  const { isLocal } = useBuyerType();
  const { format, formatUSD } = useCurrency();

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 280);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    const handleClick = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, -1)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && results[highlighted]) goTo(results[highlighted]);
      else if (query.trim()) { router.push(`/products?search=${encodeURIComponent(query)}`); setOpen(false); }
    }
    if (e.key === 'Escape') setOpen(false);
  };

  const goTo = (product) => { router.push(`/products/${product.slug}`); setOpen(false); setQuery(''); };
  const price = (p) => isLocal ? format(p.discountPrice || p.price || 0) : formatUSD(p.priceRangeMin || 0);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className={`flex items-center border-2 rounded-xl bg-white dark:bg-gray-900 transition-all ${open ? 'border-brand shadow-lg shadow-green-100 dark:shadow-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
        <Search className="w-5 h-5 text-gray-400 ml-3.5 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 py-3 px-3 bg-transparent outline-none text-gray-900 dark:text-white text-sm placeholder-gray-400"
        />
        {loading && <Loader2 className="w-4 h-4 text-gray-300 animate-spin mr-3 flex-shrink-0" />}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }} className="mr-3 p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">
          {!query && (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Popular Searches</p>
              {POPULAR.map(term => (
                <button key={term} onClick={() => { setQuery(term); search(term); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  🔍 {term}
                </button>
              ))}
            </div>
          )}

          {query && results.length === 0 && !loading && (
            <div className="px-4 py-6 text-center">
              <p className="text-gray-400 text-sm">No products found for "<strong>{query}</strong>"</p>
              <button onClick={() => { router.push(`/products?search=${encodeURIComponent(query)}`); setOpen(false); }} className="mt-2 text-brand text-sm hover:underline">Browse all products →</button>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((product, i) => (
                <button key={product._id} onClick={() => goTo(product)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${i === highlighted ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {product.images?.[0] ? <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="44px" /> : <span className="text-xl flex items-center justify-center h-full">🌿</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.category && <span className="text-xs text-gray-400">{product.category.name}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${product.isHarvestingSeason ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {product.isHarvestingSeason ? '🌿 In Season' : '⏰ Off Season'}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-brand flex-shrink-0">{price(product)}</span>
                </button>
              ))}
              {query && (
                <button onClick={() => { router.push(`/products?search=${encodeURIComponent(query)}`); setOpen(false); }} className="w-full px-4 py-2.5 text-sm text-brand hover:bg-green-50 dark:hover:bg-green-900/20 border-t border-gray-100 dark:border-gray-800 text-left transition-colors">
                  View all results for "<strong>{query}</strong>" →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

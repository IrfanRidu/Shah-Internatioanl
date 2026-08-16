'use client';
import { useState, useEffect, useCallback } from 'react';
import ProductCard from '@/components/product/ProductCard';
import Loader from '@/components/ui/Loader';
import Pagination from '@/components/ui/Pagination';
import { Search, SlidersHorizontal, Leaf, X } from 'lucide-react';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import PromoBannerStrip from '@/components/home/PromoBannerStrip';
import BannerPopup from '@/components/home/BannerPopup';

export default function ProductsPage() {
  const { buyerType } = useBuyerType();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({ search: '', category: '', harvesting: '', sort: '-createdAt' });
  const [showFilters, setShowFilters] = useState(false);
  // Batch 18 (R32): promotional/side + popup banners scoped to this page (position=products,
  // matching the same 'all'-always-included pattern the API applies server-side).
  const [promoBanners, setPromoBanners] = useState([]);
  const [popupBanners, setPopupBanners] = useState([]);

  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({
      page,
      limit: 24,
      sort: filters.sort || '-createdAt',
      ...(filters.search && { search: filters.search }),
      ...(filters.category && { category: filters.category }),
      ...(filters.harvesting && { isHarvesting: filters.harvesting }),
    });
    // Pass buyerType so the API returns the right visibility scope
    if (buyerType) p.set('buyerType', buyerType);
    try {
      const res = await fetch(`/api/products?${p}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Failed to load products');
        setProducts([]);
        setTotal(0);
      } else {
        setProducts(data.products || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } catch (err) {
      setError('Could not reach the server. Please check your connection and try again.');
      setProducts([]);
    }
    setLoading(false);
  }, [page, filters, buyerType]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  // Batch 18 (R32): fetched once on mount — this page doesn't need to react to filter/page changes
  // the way products does, banners aren't scoped to a search/filter state.
  useEffect(() => {
    fetch('/api/banners?type=promotional,side&position=products').then(r => r.json()).then(d => setPromoBanners(d.banners || [])).catch(() => {});
    fetch('/api/banners?type=popup&position=products').then(r => r.json()).then(d => setPopupBanners(d.banners || [])).catch(() => {});
  }, []);

  const setFilter = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>All Products</h1>
        <p className="text-gray-500">{total} fresh products available{buyerType === 'international' ? ' for import' : ' for delivery'}</p>
      </div>

      {/* Batch 18 (R32): promotional/side banners scoped to this page (position=products) */}
      <PromoBannerStrip banners={promoBanners} bare />
      <BannerPopup banners={popupBanners} />

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search products..." value={filters.search} onChange={e => setFilter('search', e.target.value)} className="input-field pl-10" />
          {filters.search && <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </button>
        <select value={filters.sort} onChange={e => setFilter('sort', e.target.value)} className="input-field w-auto">
          <option value="-createdAt">Newest First</option>
          <option value="price">Price: Low to High</option>
          <option value="-price">Price: High to Low</option>
          <option value="name">Name A-Z</option>
          <option value="-isFeatured">Featured First</option>
        </select>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Category</label>
            <select value={filters.category} onChange={e => setFilter('category', e.target.value)} className="input-field text-sm py-2">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Season</label>
            <select value={filters.harvesting} onChange={e => setFilter('harvesting', e.target.value)} className="input-field text-sm py-2">
              <option value="">All</option>
              <option value="true">🌿 In Season</option>
              <option value="false">⏰ Off Season</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ search: '', category: '', harvesting: '', sort: '-createdAt' })} className="w-full py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Clear Filters</button>
          </div>
        </div>
      )}

      {/* Season filter chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ label: 'All', value: '' }, { label: '🌿 In Season', value: 'true' }, { label: '⏰ Pre-Order', value: 'false' }].map(({ label, value }) => (
          <button key={label} onClick={() => setFilter('harvesting', value)} className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${filters.harvesting === value ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:border-gray-300'}`} style={filters.harvesting === value ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setFilter('category', '')} className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${!filters.category ? 'text-white border-transparent' : 'text-gray-600 border-gray-200'}`} style={!filters.category ? { backgroundColor: 'var(--color-primary)' } : {}}>All</button>
          {categories.map(c => (
            <button key={c._id} onClick={() => setFilter('category', c._id)} className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${filters.category === c._id ? 'text-white border-transparent' : 'text-gray-600 border-gray-200'}`} style={filters.category === c._id ? { backgroundColor: 'var(--color-primary)' } : {}}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Products grid */}
      {loading ? <Loader text="Loading fresh products..." /> : error ? (
        <div className="text-center py-20">
          <X className="w-16 h-16 text-red-200 mx-auto mb-4" />
          <p className="text-red-500 text-lg font-medium">Couldn't load products</p>
          <p className="text-gray-400 text-sm mt-1">{error}</p>
          <button onClick={fetchProducts} className="mt-4 text-brand underline text-sm">Try again</button>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <Leaf className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No products found</p>
          <button onClick={() => setFilters({ search: '', category: '', harvesting: '', sort: '-createdAt' })} className="mt-4 text-brand underline text-sm">Clear filters</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
          <Pagination page={page} pages={pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

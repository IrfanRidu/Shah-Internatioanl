'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Search, Edit2, Eye, ToggleLeft, ToggleRight, Trash2, Leaf, CheckSquare, Square, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

// Next.js requires useSearchParams() (used below, for issue 6's URL-synced page/search/category) to
// sit under a Suspense boundary — without it, this page loses server rendering and falls back to a
// full client-side render, and produces a build warning. Trivial to satisfy: the real page logic
// moves into an inner component, and the default export just wraps it.
export default function AdminProductsPage() {
  return (
    <Suspense fallback={<Loader />}>
      <AdminProductsPageInner />
    </Suspense>
  );
}

function AdminProductsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Issue 6: read the starting page/search/category from the URL instead of always defaulting to
  // page 1 with no filters — this is what makes a returnTo link (see queryString/Edit link below,
  // and app/admin/products/new/page.jsx) actually land back where the admin was, and also means a
  // manual refresh or the browser's own back/forward button behave correctly.
  const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [category, setCategory] = useState(() => searchParams.get('category') || '');
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // Issue 6: the exact current list state as a query string — kept in sync with the address bar
  // below, and also carried along on the Add/Edit links so a save or cancel on that page can bring
  // the admin back here precisely (see returnTo handling in app/admin/products/new/page.jsx).
  const queryString = (() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    if (search) p.set('search', search);
    if (category) p.set('category', category);
    return p.toString();
  })();

  // Keeps the browser's address bar accurate as page/search/category change. replace (not push) so
  // typing in the search box or flipping pages doesn't spam browser history with an entry per
  // keystroke/page — the admin still lands on the exact right state via a single back/forward step.
  useEffect(() => {
    router.replace(`${pathname}?${queryString}`, { scroll: false });
  }, [queryString, pathname, router]);

  // Issue 6 (adjacent bug fixed alongside it): changing the search term or category filter while on
  // e.g. page 3 could otherwise leave the admin stranded on page 3 of a completely different, maybe
  // much shorter (even empty), result set. Both jump back to page 1 of their own new results — the
  // page state itself is never reset anywhere else, so normal pagination is unaffected.
  const handleSearchChange = (e) => { setSearch(e.target.value); setPage(1); };
  const handleCategoryChange = (e) => { setCategory(e.target.value); setPage(1); };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page, limit: 20, adminView: 'true' });
    if (search) p.set('search', search);
    if (category) p.set('category', category);
    const res = await fetch(`/api/products?${p}`);
    const data = await res.json();
    setProducts(data.products || []);
    setTotal(data.total || 0);
    setPages(data.pages || 1);
    setLoading(false);
  }, [page, search, category]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || [])); }, []);

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const selectAll = () => setSelected(s => s.length === products.length ? [] : products.map(p => p._id));

  const handleBulk = async () => {
    if (!bulkAction || !selected.length) { toast.error('Select products and action'); return; }
    setBulkLoading(true);
    const res = await fetch('/api/admin/products/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selected, action: bulkAction }),
    });
    const data = await res.json();
    setBulkLoading(false);
    if (data.success) { toast.success(`Updated ${data.updated} products`); setSelected([]); setBulkAction(''); fetchProducts(); }
    else toast.error(data.message);
  };

  const toggleActive = async (product) => {
    const res = await fetch(`/api/products/${product._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !product.isActive }) });
    if (res.ok) { setProducts(prev => prev.map(p => p._id === product._id ? { ...p, isActive: !p.isActive } : p)); toast.success('Updated'); }
    else toast.error('Failed');
  };

  const handleBulkDelete = async () => {
    const res = await fetch('/api/admin/products/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selected }),
    });
    const data = await res.json();
    if (data.success) { toast.success(`Deactivated ${data.deactivated} products`); setSelected([]); setConfirmOpen(false); fetchProducts(); }
    else toast.error(data.message);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1><p className="text-sm text-gray-500">{total} total products</p></div>
        <Link href={`/admin/products/new?returnTo=${encodeURIComponent(queryString)}`}><Button variant="primary" icon={Plus}>Add Product</Button></Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search products..." value={search} onChange={handleSearchChange} className="input-field pl-9 py-2 text-sm" />
        </div>
        <select value={category} onChange={handleCategoryChange} className="input-field py-2 text-sm w-auto min-w-[160px]">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div className="bg-brand/10 border border-brand/30 rounded-2xl p-3 mb-5 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-brand">{selected.length} selected</span>
          <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className="text-sm border border-brand/30 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/30">
            <option value="">Choose action...</option>
            <option value="activate">✅ Activate</option>
            <option value="deactivate">❌ Deactivate</option>
            <option value="feature">⭐ Mark Featured</option>
            <option value="unfeature">Remove Featured</option>
            <option value="organic">🍃 Mark Organic</option>
          </select>
          <Button onClick={handleBulk} loading={bulkLoading} variant="primary" size="sm" disabled={!bulkAction}>Apply</Button>
          <Button onClick={() => { setConfirmAction('delete'); setConfirmOpen(true); }} variant="danger" size="sm">Deactivate Selected</Button>
          <button onClick={() => setSelected([])} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      )}

      {loading ? <Loader /> : (
        <>
          {/* Issue 5: the table below needs horizontal scroll to reach its last (Actions) column,
              which makes Edit effectively undiscoverable on a phone-width screen — so mobile gets
              this reflowed card list instead, with the SAME data and an unmissable Edit button.
              Desktop/tablet keeps the table exactly as before. */}
          <div className="md:hidden space-y-3">
            {products.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-16 text-center text-gray-400">
                <Leaf className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No products found</p>
              </div>
            ) : products.map(p => (
              <div key={p._id} className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 ${selected.includes(p._id) ? 'border-brand bg-green-50/50 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-800'}`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleSelect(p._id)} className="mt-1 text-gray-400 hover:text-brand shrink-0" aria-label="Select product">
                    {selected.includes(p._id) ? <CheckSquare className="w-4 h-4 text-brand" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {p.images?.[0] ? <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="56px" /> : <Leaf className="w-6 h-6 m-4 text-gray-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 truncate">{p.category?.name || '—'}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">৳{p.price?.toLocaleString() || '—'}</span>
                      {p.discountPrice && <span className="text-xs text-green-600">Sale: ৳{p.discountPrice?.toLocaleString()}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {p.isHarvestingSeason
                        ? <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-lg">🌿 Season</span>
                        : <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-lg">⏰ Off</span>}
                      <span className="text-xs text-gray-500">{p.quantity || 0} {p.unit}</span>
                    </div>
                  </div>
                  <button onClick={() => toggleActive(p)} className="shrink-0" aria-label="Toggle active">
                    {p.isActive ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <Link
                    href={`/admin/products/${p._id}?returnTo=${encodeURIComponent(queryString)}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand/10 text-brand text-sm font-semibold"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </Link>
                  <Link
                    href={`/products/${p.slug}`}
                    target="_blank"
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium"
                    aria-label="View on storefront"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3">
                      <button onClick={selectAll} className="text-gray-400 hover:text-gray-600">
                        {selected.length === products.length && products.length > 0 ? <CheckSquare className="w-4 h-4 text-brand" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    {['Product', 'Category', 'Price (BDT)', 'USD Range', 'Cost 🔒', 'Season', 'Stock', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr><td colSpan={10} className="py-16 text-center text-gray-400">
                      <Leaf className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No products found</p>
                    </td></tr>
                  ) : products.map(p => (
                    <tr key={p._id} className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${selected.includes(p._id) ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(p._id)} className="text-gray-400 hover:text-brand">
                          {selected.includes(p._id) ? <CheckSquare className="w-4 h-4 text-brand" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {p.images?.[0] ? <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="40px" /> : <Leaf className="w-5 h-5 m-2.5 text-gray-300" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[150px]">{p.name}</p>
                            {(p.scientificName || p.localName) && (
                              <p className="text-xs text-gray-400 italic truncate">
                                {[p.scientificName, p.localName].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            <div className="flex gap-1 mt-0.5">
                              {p.isFeatured && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">⭐</span>}
                              {p.isOrganic && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">🌿</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.category?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">৳{p.price?.toLocaleString() || '—'}</p>
                          {p.discountPrice && <p className="text-xs text-green-600">Sale: ৳{p.discountPrice?.toLocaleString()}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.priceRangeMin ? `$${p.priceRangeMin}–$${p.priceRangeMax}` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-amber-600 font-medium">{p.productCost ? `৳${p.productCost}` : '—'}</td>
                      <td className="px-4 py-3">
                        {p.isHarvestingSeason
                          ? <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">🌿 Season</span>
                          : <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">⏰ Off</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{p.quantity || 0} {p.unit}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(p)}>
                          {p.isActive ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/products/${p.slug}`} target="_blank" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/admin/products/${p._id}?returnTo=${encodeURIComponent(queryString)}`} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-4 h-4" /></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pages={pages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Deactivate ${selected.length} Products?`}
        message="Selected products will be hidden from the store. You can reactivate them anytime."
        confirmLabel="Deactivate"
        type="danger"
      />
    </div>
  );
}

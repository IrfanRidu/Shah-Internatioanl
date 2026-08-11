'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Search, Edit2, Eye, ToggleLeft, ToggleRight, Trash2, Leaf, CheckSquare, Square, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

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
        <Link href="/admin/products/new"><Button variant="primary" icon={Plus}>Add Product</Button></Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 py-2 text-sm" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="input-field py-2 text-sm w-auto min-w-[160px]">
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
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
                          <Link href={`/admin/products/${p._id}`} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all"><Edit2 className="w-4 h-4" /></Link>
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

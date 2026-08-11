'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { resizeImageFile } from '@/lib/clientImageResize';
import { Upload, X, Save, ArrowLeft, RefreshCw } from 'lucide-react';
import { computeHarvestingSeason } from '@/lib/utils';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Moved OUTSIDE ProductForm so they are never re-created on state change.
// If these were defined inside the component, every keystroke would cause React
// to unmount+remount them (new function reference = new component type),
// which kills input focus after each character typed.
function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mb-5">
      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all ${checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <div
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
          style={{ left: checked ? '21px' : '2px' }}
        />
      </button>
    </label>
  );
}

export default function NewProductPage() {
  return <ProductForm />;
}

export function ProductForm({ initialData = {}, productId = null }) {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncingFx, setSyncingFx] = useState(false);
  const [form, setForm] = useState({
    name: '', scientificName: '', localName: '', hsCode: '', description: '', shortDescription: '',
    category: '', subcategorySlug: '',
    price: '', discountPrice: '', priceRangeMin: '', priceRangeMax: '', productCost: '',
    quantity: '', unit: 'kg', minimumOrderQuantity: '1',
    harvestingSeason: '', harvestingMonths: [],
    isHarvestingSeason: true, allowPreOrder: true,
    countryOfOrigin: 'Bangladesh', harvestingLocation: '',
    isActive: true, isFeatured: false, isOrganic: false,
    availableForLocal: true, availableForInternational: true,
    certifications: initialData.certifications || [],
    storageInstructions: initialData.storageInstructions || '',
    shelfLife: initialData.shelfLife || '',
    images: initialData.images || [],
    // Spread initialData FIRST, then overwrite the fields that need type coercion.
    // This prevents initialData from clobbering our processed values below.
    ...Object.fromEntries(Object.entries(initialData).filter(([k]) => !['tags','images','certifications','storageInstructions','shelfLife','isHarvestingSeason','allowPreOrder'].includes(k))),
    isHarvestingSeason: initialData.isHarvestingSeason ?? true,
    allowPreOrder: initialData.allowPreOrder ?? true,
    // tags: always a comma-string in the form input, regardless of what type DB returns
    tags: Array.isArray(initialData.tags)
      ? initialData.tags.join(', ')
      : typeof initialData.tags === 'string'
        ? initialData.tags
        : '',
  });

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  // Stable setter — uses functional update so it never changes reference
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const syncPriceRangeFromBDT = async () => {
    const bdtPrice = Number(form.price);
    if (!bdtPrice) { toast.error('Enter a local price (BDT) first'); return; }
    setSyncingFx(true);
    try {
      const res = await fetch('/api/currency');
      const data = await res.json();
      const bdtPerUsd = data.rates?.BDT;
      if (!bdtPerUsd) throw new Error('Rate unavailable');
      const usd = bdtPrice / bdtPerUsd;
      set('priceRangeMin', (usd * 0.9).toFixed(2));
      set('priceRangeMax', (usd * 1.15).toFixed(2));
      toast.success(`Synced at ১${bdtPerUsd.toFixed(2)} = $1`);
    } catch {
      toast.error('Could not fetch live rate — enter manually');
    }
    setSyncingFx(false);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      // Resized client-side first — see resizeImageFile's own comment on why that matters on Vercel.
      resizeImageFile(file, { maxDimension: 1600, quality: 0.85 }).then((dataUrl) => {
        fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl, folder: 'products' }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) setForm(p => ({ ...p, images: [...p.images, data.url] }));
            else toast.error(data.message || 'Image upload failed');
          });
      }).catch((err) => toast.error(err.message || 'Image upload failed'));
    }
    setUploading(false);
  };

  const toggleMonth = (idx) => {
    setForm(p => ({
      ...p,
      harvestingMonths: p.harvestingMonths.includes(idx)
        ? p.harvestingMonths.filter(m => m !== idx)
        : [...p.harvestingMonths, idx],
    }));
  };

  const selectedCat = categories.find(c => c._id === form.category);
  // Issue 4: no more manual toggle — this is the single source of truth for both the status badge
  // below and what actually gets submitted. null means no months picked yet (nothing to derive from).
  const computedSeason = computeHarvestingSeason(form.harvestingMonths);

  const handleSubmit = async () => {
    if (!form.name || !form.category || !form.description) {
      toast.error('Name, category, and description are required'); return;
    }
    setLoading(true);
    const body = {
      ...form,
      price: Number(form.price) || null,
      discountPrice: Number(form.discountPrice) || null,
      priceRangeMin: Number(form.priceRangeMin) || null,
      priceRangeMax: Number(form.priceRangeMax) || null,
      productCost: Number(form.productCost) || null,
      quantity: Number(form.quantity) || 0,
      minimumOrderQuantity: Number(form.minimumOrderQuantity) || 1,
      shelfLife: form.shelfLife === '' || form.shelfLife === null || form.shelfLife === undefined ? null : Number(form.shelfLife),
      // Issue 4: derived from harvestingMonths, never from a hand-set toggle. Falls back to
      // whatever was already on the product when no months are picked at all (legacy data).
      isHarvestingSeason: computedSeason !== null ? computedSeason : form.isHarvestingSeason,
      tags: (() => {
        const t = form.tags;
        if (!t) return [];
        if (Array.isArray(t)) return t.map(s => String(s).trim()).filter(Boolean);
        return String(t).split(',').map(s => s.trim()).filter(Boolean);
      })(),
    };
    const url = productId ? `/api/products/${productId}` : '/api/products';
    const method = productId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      toast.success(productId ? 'Product updated!' : 'Product created!');
      router.push('/admin/products');
    } else toast.error(data.message || 'Failed');
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{productId ? 'Edit Product' : 'Add New Product'}</h1>
          <p className="text-sm text-gray-500">Fill in the product details below</p>
        </div>
      </div>

      <Section title="📸 Product Images">
        <div className="flex flex-wrap gap-3">
          {form.images.map((img, i) => (
            <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 group">
              <Image src={img} alt="" fill className="object-cover" sizes="96px" />
              <button
                onClick={() => setForm(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className={`w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:border-brand hover:bg-green-50 dark:hover:bg-green-900/20 ${uploading ? 'opacity-50' : ''}`}>
            <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
            <Upload className="w-5 h-5 text-gray-400 mb-1" />
            <span className="text-xs text-gray-400">{uploading ? 'Uploading...' : 'Upload'}</span>
          </label>
        </div>
      </Section>

      <Section title="📝 Basic Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Product Name" required placeholder="e.g. Bitter Gourd" value={form.name} onChange={e => set('name', e.target.value)} />
          <Input label="Botanical Name" placeholder="e.g. Momordica charantia" value={form.scientificName} onChange={e => set('scientificName', e.target.value)} />
          <Input label="Local Name" placeholder="e.g. Korola" hint="Optional — common/regional name (e.g. Bengali), searchable everywhere Product Name is" value={form.localName} onChange={e => set('localName', e.target.value)} />
          <Input label="HS Code" placeholder="e.g. 07099090" hint="Optional — customs code, auto-fills onto Export Dashboard shipments when this product is picked" value={form.hsCode} onChange={e => set('hsCode', e.target.value)} />
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description <span className="text-red-500">*</span></label>
            <textarea rows={4} placeholder="Detailed product description..." value={form.description} onChange={e => set('description', e.target.value)} className="input-field resize-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Short Description</label>
            <textarea rows={2} placeholder="Brief summary (for cards)..." value={form.shortDescription} onChange={e => set('shortDescription', e.target.value)} className="input-field resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category <span className="text-red-500">*</span></label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="input-field">
              <option value="">Select category</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          {selectedCat?.subcategories?.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subcategory</label>
              <select value={form.subcategorySlug} onChange={e => set('subcategorySlug', e.target.value)} className="input-field">
                <option value="">Select subcategory</option>
                {selectedCat.subcategories.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
            </div>
          )}
          <Input label="Tags" placeholder="tomato, organic, summer (comma separated)" value={form.tags} onChange={e => set('tags', e.target.value)} />
        </div>
      </Section>

      <Section title="💰 Pricing (Admin Eyes Only for Cost)">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Input label="Local Price (BDT)" type="number" placeholder="0" value={form.price} onChange={e => set('price', e.target.value)} />
          <Input label="Discounted Price (BDT)" type="number" placeholder="0" value={form.discountPrice} onChange={e => set('discountPrice', e.target.value)} />
          <Input label="Product Cost (BDT) 🔒" type="number" placeholder="Admin only" value={form.productCost} onChange={e => set('productCost', e.target.value)} />
          <Input label="Int'l Price Min (USD)" type="number" placeholder="0.00" value={form.priceRangeMin} onChange={e => set('priceRangeMin', e.target.value)} />
          <Input label="Int'l Price Max (USD)" type="number" placeholder="0.00" value={form.priceRangeMax} onChange={e => set('priceRangeMax', e.target.value)} />
          <div className="flex items-end">
            <button
              type="button"
              onClick={syncPriceRangeFromBDT}
              disabled={syncingFx}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-brand hover:text-brand transition-all disabled:opacity-50 w-full justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${syncingFx ? 'animate-spin' : ''}`} />
              {syncingFx ? 'Syncing...' : 'Sync from BDT'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          💡 "Sync from BDT" converts the local price to USD at today's live rate with a ±10–15% export band. You can still edit the result by hand.
        </p>
      </Section>

      <Section title="📦 Inventory & Units">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Input label="Quantity" type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Unit</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)} className="input-field">
              {['kg', 'ton', 'piece', 'box', 'bundle', 'bag', 'liter'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <Input label="Min. Order Qty" type="number" value={form.minimumOrderQuantity} onChange={e => set('minimumOrderQuantity', e.target.value)} />
          <Input label="Shelf Life (Days)" type="number" min="0" placeholder="e.g. 7" value={form.shelfLife} onChange={e => set('shelfLife', e.target.value)} />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Storage Instructions</label>
          <textarea rows={2} value={form.storageInstructions} onChange={e => set('storageInstructions', e.target.value)} placeholder="Keep refrigerated at 4°C..." className="input-field resize-none" />
        </div>
      </Section>

      <Section title="🌿 Origin & Season">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Input label="Country of Origin" value={form.countryOfOrigin} onChange={e => set('countryOfOrigin', e.target.value)} />
          <Input label="Harvesting Location" placeholder="e.g. Rajshahi, Bangladesh" value={form.harvestingLocation} onChange={e => set('harvestingLocation', e.target.value)} />
          <Input label="Harvesting Season" placeholder="e.g. June–September" value={form.harvestingSeason} onChange={e => set('harvestingSeason', e.target.value)} />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Harvesting Months</label>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((m, i) => (
              <button
                type="button"
                key={m}
                onClick={() => toggleMonth(i + 1)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.harvestingMonths.includes(i + 1) ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}
                style={form.harvestingMonths.includes(i + 1) ? { backgroundColor: 'var(--color-primary)' } : {}}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Current Harvesting Status</span>
            {computedSeason === null && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Pick months above ↑</span>
            )}
            {computedSeason === true && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">🟢 Currently Harvesting</span>
            )}
            {computedSeason === false && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">⏰ Off Season</span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Automatically determined from the harvesting months selected above and today's date — it
            switches on and off by itself as the calendar turns, so there's nothing to set by hand.
          </p>
          <Toggle label="Allow Pre-Order (Off Season)" checked={form.allowPreOrder} onChange={v => set('allowPreOrder', v)} />
        </div>
      </Section>

      <Section title="⚙️ Settings & Visibility">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Toggle label="Product Active" checked={form.isActive} onChange={v => set('isActive', v)} />
            <Toggle label="Featured Product" checked={form.isFeatured} onChange={v => set('isFeatured', v)} />
            <Toggle label="Organic Certified" checked={form.isOrganic} onChange={v => set('isOrganic', v)} />
          </div>
          <div className="space-y-3">
            <Toggle label="Available for Local Buyers" checked={form.availableForLocal} onChange={v => set('availableForLocal', v)} />
            <Toggle label="Available for International Buyers" checked={form.availableForInternational} onChange={v => set('availableForInternational', v)} />
          </div>
        </div>
      </Section>

      <div className="flex gap-3">
        <Button onClick={handleSubmit} loading={loading} variant="primary" size="lg" icon={Save}>
          {productId ? 'Update Product' : 'Create Product'}
        </Button>
        <Button onClick={() => router.back()} variant="ghost" size="lg">Cancel</Button>
      </div>
    </div>
  );
}

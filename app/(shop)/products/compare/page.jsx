'use client';
import { useCompareStore } from '@/store/compareStore';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import Image from 'next/image';
import Link from 'next/link';
import StarRating from '@/components/product/StarRating';
import SeasonLabel from '@/components/product/SeasonLabel';
import { X, CheckCircle, XCircle } from 'lucide-react';
import { getMoqForBuyer } from '@/lib/utils';

export default function ComparePage() {
  const { items, removeFromCompare } = useCompareStore();
  const { buyerType, isLocal } = useBuyerType();
  const { format, formatUSD } = useCurrency();

  if (items.length < 2) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Product Comparison</h1>
        <p className="text-gray-500 mb-6">Add at least 2 products to compare. Use the compare button on product cards.</p>
        <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold" style={{ backgroundColor: 'var(--color-primary)' }}>Browse Products →</Link>
      </div>
    );
  }

  const ATTRS = [
    { label: 'Category', key: p => p.category?.name || '—' },
    { label: 'Price (Local)', key: p => isLocal ? format(p.discountPrice || p.price || 0) : 'N/A' },
    { label: 'Import Price Range', key: p => !isLocal ? `$${p.priceRangeMin}–$${p.priceRangeMax}` : 'N/A' },
    { label: 'Unit', key: p => p.unit || '—' },
    { label: 'Min. Order', key: p => `${getMoqForBuyer(p, buyerType)} ${p.unit}` },
    { label: 'Season', key: p => p.harvestingSeason || '—' },
    { label: 'Origin', key: p => p.countryOfOrigin || '—' },
    { label: 'Harvesting Location', key: p => p.harvestingLocation || '—' },
    { label: 'Shelf Life', key: p => p.shelfLife ? `${p.shelfLife} day${p.shelfLife === 1 ? '' : 's'}` : '—' },
    { label: 'Rating', key: p => p.reviewCount > 0 ? `${p.averageRating?.toFixed(1)} ★ (${p.reviewCount})` : 'No reviews' },
    { label: 'Certifications', key: p => p.certifications?.map(c => c.name).join(', ') || 'None' },
    { label: 'Organic', key: p => p.isOrganic, type: 'bool' },
    { label: 'Local Available', key: p => p.availableForLocal, type: 'bool' },
    { label: 'Export Available', key: p => p.availableForInternational, type: 'bool' },
    { label: 'Pre-order', key: p => p.allowPreOrder, type: 'bool' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Comparison</h1>
        <Link href="/products" className="text-sm text-brand hover:underline">← Back to Products</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <td className="p-4 text-xs font-semibold text-gray-400 uppercase w-40">Attribute</td>
              {items.map(p => (
                <td key={p._id} className="p-4 text-center">
                  <div className="relative">
                    <button onClick={() => removeFromCompare(p._id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 z-10 hover:bg-red-600 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden mx-auto mb-2">
                      <Image src={p.images?.[0] || 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=200&q=80'} alt={p.name} fill className="object-cover" sizes="80px" />
                    </div>
                    <Link href={`/products/${p.slug}`} className="font-bold text-sm text-gray-900 dark:text-white hover:text-brand transition-colors block text-center leading-tight">{p.name}</Link>
                    <div className="mt-1 flex justify-center"><SeasonLabel isHarvestingSeason={p.isHarvestingSeason} /></div>
                  </div>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {ATTRS.map(({ label, key, type }) => (
              <tr key={label} className="border-t border-gray-100 dark:border-gray-800 even:bg-gray-50/50 dark:even:bg-gray-800/30">
                <td className="p-4 text-xs font-semibold text-gray-500">{label}</td>
                {items.map(p => {
                  const val = key(p);
                  return (
                    <td key={p._id} className="p-4 text-center text-sm text-gray-700 dark:text-gray-300">
                      {type === 'bool' ? (val ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <XCircle className="w-5 h-5 text-red-300 mx-auto" />) : val}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <td className="p-4" />
              {items.map(p => (
                <td key={p._id} className="p-4 text-center">
                  <Link href={`/products/${p.slug}`} className="inline-block px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)' }}>
                    View Product →
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

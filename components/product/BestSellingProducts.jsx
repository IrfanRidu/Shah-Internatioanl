'use client';
import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import Carousel from '@/components/ui/Carousel';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { isProductVisibleToBuyer } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';

export default function BestSellingProducts({ products: productsProp, excludeId, limit = 8 }) {
  const [fetchedProducts, setFetchedProducts] = useState([]);
  const [loading, setLoading] = useState(!productsProp);
  const { buyerType } = useBuyerType();

  useEffect(() => {
    // Normal path: the product detail page already computed real best-sellers server-side,
    // pre-deduped against every other section (issue 32) — nothing to fetch. Only a caller that
    // doesn't supply `products` falls back to the old self-fetch via /api/products/best-selling.
    if (productsProp) { setLoading(false); return; }
    const q = new URLSearchParams({ limit: String(limit) });
    if (excludeId) q.set('exclude', excludeId);
    fetch(`/api/products/best-selling?${q}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setFetchedProducts((d.products || []).filter(p => isProductVisibleToBuyer(p, buyerType))))
      .catch(() => setFetchedProducts([]))
      .finally(() => setLoading(false));
  }, [productsProp, excludeId, limit, buyerType]);

  const products = (productsProp || fetchedProducts).filter(p => isProductVisibleToBuyer(p, buyerType));
  if (loading || products.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mt-6">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-5 h-5 text-amber-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Best Selling Products</h2>
      </div>
      <Carousel showArrows autoplay>
        {products.map(p => (
          <div key={p._id} className="flex-shrink-0 w-48 md:w-56">
            <ProductCard product={p} />
          </div>
        ))}
      </Carousel>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import Carousel from '@/components/ui/Carousel';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { isProductVisibleToBuyer } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

export default function RecommendedForYou({ products: productsProp, personalized: personalizedProp, excludeId, categoryId, limit = 8 }) {
  const [fetchedProducts, setFetchedProducts] = useState([]);
  const [fetchedPersonalized, setFetchedPersonalized] = useState(false);
  const [loading, setLoading] = useState(!productsProp);
  const { buyerType } = useBuyerType();

  useEffect(() => {
    // Normal path: the product detail page already computed this list server-side (order-history
    // based when logged in, else same-category), pre-deduped against every other section on the page
    // (issue 32) — nothing to fetch. Only a caller that doesn't supply `products` falls back to the
    // old self-fetch via /api/products/recommended.
    if (productsProp) { setLoading(false); return; }
    const q = new URLSearchParams({ limit: String(limit) });
    if (excludeId) q.set('exclude', excludeId);
    if (categoryId) q.set('category', categoryId);
    if (buyerType) q.set('buyerType', buyerType);
    fetch(`/api/products/recommended?${q}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setFetchedProducts((d.products || []).filter(p => isProductVisibleToBuyer(p, buyerType)));
        setFetchedPersonalized(!!d.personalized);
      })
      .catch(() => setFetchedProducts([]))
      .finally(() => setLoading(false));
  }, [productsProp, excludeId, categoryId, limit, buyerType]);

  const products = (productsProp || fetchedProducts).filter(p => isProductVisibleToBuyer(p, buyerType));
  const personalized = productsProp ? personalizedProp : fetchedPersonalized;

  if (loading || products.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {personalized ? 'Picked Based on Your Past Orders' : 'You Might Also Like'}
        </h2>
      </div>
      <p className="text-xs text-gray-400 mb-5 ml-7">
        {personalized ? 'Based on categories you\'ve ordered from before' : 'Popular picks in this category'}
      </p>
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

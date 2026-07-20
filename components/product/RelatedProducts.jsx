'use client';
import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import Carousel from '@/components/ui/Carousel';
import { Leaf } from 'lucide-react';

export default function RelatedProducts({ products: productsProp, categoryId, currentProductId, limit = 8 }) {
  const [fetchedProducts, setFetchedProducts] = useState([]);
  const [loading, setLoading] = useState(!productsProp);

  useEffect(() => {
    // Normal path: the product detail page already computed this list server-side, pre-deduped
    // against every other section (issue 32) — nothing to fetch here. Only a caller that doesn't
    // supply `products` falls back to the old self-fetch.
    if (productsProp) { setLoading(false); return; }
    if (!categoryId) { setLoading(false); return; }
    fetch(`/api/products?category=${categoryId}&limit=${limit}`)
      .then(r => r.json())
      .then(d => {
        setFetchedProducts((d.products || []).filter(p => p._id !== currentProductId).slice(0, limit));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productsProp, categoryId, currentProductId, limit]);

  const products = productsProp || fetchedProducts;
  if (loading || !products.length) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mt-6">
      <div className="flex items-center gap-2 mb-5">
        <Leaf className="w-5 h-5 text-brand" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Related Products</h2>
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

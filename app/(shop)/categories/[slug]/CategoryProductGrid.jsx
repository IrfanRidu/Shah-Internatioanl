'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import ProductCard from '@/components/product/ProductCard';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { isProductVisibleToBuyer } from '@/lib/utils';

export default function CategoryProductGrid({ category, products }) {
  const { buyerType } = useBuyerType();
  const [activeSub, setActiveSub] = useState('all');

  const visibleProducts = useMemo(() => {
    let list = products.filter(p => isProductVisibleToBuyer(p, buyerType));
    if (activeSub !== 'all') {
      list = list.filter(p => p.subcategorySlug === activeSub);
    }
    return list;
  }, [products, buyerType, activeSub]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with category image */}
      <div className="mb-8 flex items-center gap-4">
        {category.image && (
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
            <Image src={category.image} alt={category.name} fill className="object-cover" sizes="64px" />
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>{category.name}</h1>
          {category.description && <p className="text-gray-500">{category.description}</p>}
          <p className="text-sm text-gray-400 mt-1">{visibleProducts.length} products available</p>
        </div>
      </div>

      {/* Subcategory filter chips, with images if uploaded */}
      {category.subcategories?.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveSub('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeSub === 'all' ? 'text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            style={activeSub === 'all' ? { backgroundColor: 'var(--color-primary)' } : {}}
          >
            All
          </button>
          {category.subcategories.filter(s => s.isActive !== false).map(s => (
            <button
              key={s.slug}
              onClick={() => setActiveSub(s.slug)}
              className={`flex items-center gap-1.5 pl-1.5 pr-4 py-1 rounded-full text-sm font-medium transition-all ${activeSub === s.slug ? 'text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              style={activeSub === s.slug ? { backgroundColor: 'var(--color-primary)' } : {}}
            >
              {s.image && (
                <span className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-white">
                  <Image src={s.image} alt={s.name} fill className="object-cover" sizes="24px" />
                </span>
              )}
              {s.name}
            </button>
          ))}
        </div>
      )}

      {visibleProducts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No products in this category yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {visibleProducts.map(p => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </div>
  );
}

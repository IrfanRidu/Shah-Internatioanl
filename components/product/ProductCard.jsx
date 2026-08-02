'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Eye, MessageSquare, GitCompareArrows, Heart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useStore } from '@/store/useStore';
import { useCompareStore } from '@/store/compareStore';
import SeasonLabel from './SeasonLabel';
import PriceDisplay from './PriceDisplay';
import toast from 'react-hot-toast';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { isLocal } = useBuyerType();
  const { toggleWishlist, isWishlisted } = useStore();
  const { addToCompare, isInCompare, removeFromCompare } = useCompareStore();
  const [imgErr, setImgErr] = useState(false);
  const img = !imgErr && product.images?.[0] ? product.images[0] : 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=400&q=80';
  const wishlisted = isWishlisted(product._id);
  const inCompare = isInCompare(product._id);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1, !product.isHarvestingSeason);
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
    toast.success(wishlisted ? 'Removed from wishlist' : '❤️ Added to wishlist');
  };

  const handleCompare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCompare) removeFromCompare(product._id);
    else addToCompare(product);
  };

  return (
    <Link href={`/products/${product.slug}`} className="card group flex flex-col snap-start flex-shrink-0" style={{ width: '170px' }}>
      {/* Image — compact square */}
      <div className="relative overflow-hidden bg-gray-100 flex-shrink-0 rounded-t-2xl" style={{ height: '160px' }}>
        <Image
          src={img} alt={product.name} fill
          sizes="(max-width:640px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          onError={() => setImgErr(true)}
        />
        {/* Top badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <SeasonLabel isHarvestingSeason={product.isHarvestingSeason} />
        </div>
        {/* Top right actions */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button onClick={handleWishlist} className={`p-1.5 rounded-lg shadow backdrop-blur-sm transition-all ${wishlisted ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-500 hover:bg-red-50 hover:text-red-500'}`} title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
            <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />
          </button>
          <button onClick={handleCompare} className={`flex items-center gap-1 px-1.5 py-1.5 rounded-lg shadow backdrop-blur-sm transition-all ${inCompare ? 'bg-brand text-white' : 'bg-white/80 text-gray-500 hover:text-brand'}`} title={inCompare ? 'Remove from comparison' : 'Add to comparison'}>
            <GitCompareArrows className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3">
          <div className="flex gap-2">
            {isLocal && (
              <button onClick={handleAddToCart} className="text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg transition-all flex items-center gap-1" style={{ backgroundColor: 'var(--color-primary)' }}>
                <ShoppingCart className="w-3 h-3" /> {product.isHarvestingSeason ? 'Add' : 'Pre-Order'}
              </button>
            )}
            {!isLocal && (
              <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Quote
              </span>
            )}
          </div>
        </div>
        {/* Discount badge */}
        {product.discountPrice && product.price && (
          <div className="absolute bottom-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            -{Math.round((1 - product.discountPrice / product.price) * 100)}%
          </div>
        )}
      </div>

      {/* Info — flex column so every card in a row ends up the same total height, and the button is
          always pinned to the bottom via mt-auto instead of being clipped by a too-small fixed height */}
      <div className="p-2.5 flex flex-col flex-1">
        <p className="text-xs text-gray-400 truncate leading-tight h-4">{product.category?.name || '\u00A0'}</p>
        <h3 className="font-semibold text-gray-900 dark:text-white text-xs leading-tight mt-0.5 line-clamp-2" style={{ minHeight: '2rem' }}>{product.name}</h3>
        {/* Issue 6: organic/featured badges moved off the image to right under the product name. */}
        {(product.isFeatured || product.isOrganic) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {product.isFeatured && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">⭐ Featured</span>}
            {product.isOrganic && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">🌿 Organic</span>}
          </div>
        )}
        <div className="mt-auto">
          <PriceDisplay product={product} size="sm" />
          {isLocal ? (
            <button onClick={handleAddToCart} className="mt-1 w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)' }}>
              {product.isHarvestingSeason ? '🛒 Add' : '⏰ Pre-Order'}
            </button>
          ) : (
            <Link href={`/products/${product.slug}#quotation`} onClick={e => e.stopPropagation()} className="mt-1 block w-full py-1.5 rounded-lg text-xs font-semibold text-center text-white bg-blue-600 hover:bg-blue-700 transition-all">
              💬 Quote
            </Link>
          )}
        </div>
      </div>
    </Link>
  );
}

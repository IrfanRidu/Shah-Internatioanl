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
    // Batch 19 (R33-10): was `style={{ width: '170px' }} + flex-shrink-0` — a hardcoded width that
    // fought every single one of this component's 8 consumers, EVERY one of which already wraps
    // it in their own sizing container (grid columns on the 3 grid-based listing pages, or a
    // `flex-shrink-0 w-48/w-52...` div on the 5 carousel-based sections) — the card rendering at a
    // fixed 170px regardless of that wrapper's actual width is exactly why cards looked
    // inconsistently sized/gapped depending on context. `w-full` makes this component correctly
    // fill whatever its caller already sized for it, in every context, uniformly.
    <Link href={`/products/${product.slug}`} className="card group flex flex-col snap-start w-full">
      {/* Image — the user confirmed the campaign strip's cards (FlashSaleSection.jsx, 150px wide ×
          140px tall image) are "perfect in ratio". That's 150:140 = 15:14 — expressed here as an
          aspect-ratio (not fixed pixels like the campaign card uses) because this component, unlike
          the campaign card, is deliberately width-flexible across 9 different consumers (grid columns
          on 3 pages, w-48 through w-60 wrappers on 6 carousels — see the Batch 19 note above) rather
          than always exactly 150px; aspect-[15/14] reproduces the SAME proportion at whatever width
          each context actually renders it. (Previously aspect-[4/5] — a portrait ratio meant to fix an
          earlier "too square" report — overshot in the opposite direction and made the image section
          too tall/long.) */}
      <div className="relative overflow-hidden bg-gray-100 flex-shrink-0 rounded-t-2xl aspect-[15/14]">
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
        <h3 className="font-semibold text-gray-900 dark:text-white text-xs leading-tight mt-0.5 line-clamp-2" style={{ minHeight: '2rem' }}>
          {product.name}{product.localName && <span className="font-normal text-gray-500 dark:text-gray-400"> ({product.localName})</span>}
        </h3>
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

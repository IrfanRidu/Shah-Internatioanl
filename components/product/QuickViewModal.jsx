'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useStore } from '@/store/useStore';
import PriceDisplay from '@/components/product/PriceDisplay';
import QuotationModal from '@/components/product/QuotationModal';
import Button from '@/components/ui/Button';
import { getMoqForBuyer, getEffectivePricing } from '@/lib/utils';
import { X, ShoppingCart, Zap, Heart, MessageSquare, MapPin, Calendar, Award, Sprout, CheckCircle, Tag, Leaf, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

// Batch 20 follow-up (issue 2): replaces ProductCard.jsx's old hover overlay, which just repeated
// whichever action button (Add to Cart / Quote / Pre-Order) was already shown, unhoverable, right
// below it on the same card — showing the identical action twice at once. This gives the hover state
// something actually useful to reveal instead: everything the user listed (description, specs, add
// to cart, buy now, wishlist, quantity) without leaving the current page. Content and behavior are
// deliberately kept consistent with the full product-details page (app/(shop)/products/[slug]/
// ProductDetailClient.jsx) — same spec-tile set, same MOQ logic, same modal shell pattern as
// QuotationModal.jsx — rather than inventing a parallel, potentially-diverging implementation.
export default function QuickViewModal({ isOpen, onClose, product, campaignItem = null }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { buyerType, isLocal } = useBuyerType();
  const { toggleWishlist, isWishlisted } = useStore();
  const effectiveMoq = getMoqForBuyer(product, buyerType);
  const [qty, setQty] = useState(effectiveMoq);
  const [showQuote, setShowQuote] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Reset to this product's own MOQ each time the modal is (re)opened for a (possibly different)
  // product — without this, qty would carry over from whatever was last viewed.
  useEffect(() => { if (isOpen) setQty(getMoqForBuyer(product, buyerType)); }, [isOpen, product, buyerType]);

  // Lock body scroll while open — same as QuotationModal.
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !mounted || !product) return null;

  const handleAddToCart = () => {
    // Same campaign-vs-own-discount comparison as ProductCard.jsx's handleAddToCart — degrades to
    // the product's own existing discount exactly as before when opened outside a campaign context
    // (campaignItem stays null for every non-campaign caller).
    const pricing = getEffectivePricing(product, campaignItem);
    const cartProduct = pricing.hasDiscount ? { ...product, discountPrice: pricing.localPrice } : product;
    addItem(cartProduct, qty, !product.isHarvestingSeason);
  };
  const handleBuyNow = () => {
    const pricing = getEffectivePricing(product, campaignItem);
    const cartProduct = pricing.hasDiscount ? { ...product, discountPrice: pricing.localPrice } : product;
    addItem(cartProduct, qty, !product.isHarvestingSeason);
    onClose();
    router.push('/checkout');
  };
  const wishlisted = isWishlisted(product._id);
  // Same fallback ProductCard.jsx already uses — no local placeholder asset exists in /public,
  // confirmed before relying on one, rather than risking a broken image for any product with no
  // photos uploaded yet.
  const img = product.images?.[0] || 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=400&q=80';
  const handleToggleWishlist = () => {
    toggleWishlist(product);
    toast.success(wishlisted ? 'Removed from wishlist' : '❤️ Added to wishlist');
  };

  // Same spec-tile set as ProductDetailClient.jsx, in the same order, including admin-defined
  // additionalFields — kept identical so Quick View and the full details page never disagree with
  // each other about what a product's own specs actually are.
  const specs = [
    { icon: MapPin, label: 'Origin', value: product.countryOfOrigin },
    { icon: Leaf, label: 'Location', value: product.harvestingLocation },
    { icon: Calendar, label: 'Season', value: product.harvestingSeason },
    { icon: Award, label: 'Min. Order', value: `${effectiveMoq} ${product.unit}` },
    ...(product.isOrganic ? [{ icon: Sprout, label: 'Certification', value: 'Organic Certified' }] : []),
    ...(product.shelfLife ? [{ icon: CheckCircle, label: 'Shelf Life', value: `${product.shelfLife} day${product.shelfLife === 1 ? '' : 's'}` }] : []),
    ...(product.additionalFields || []).map(f => ({ icon: Tag, label: f.label, value: f.value })),
  ].filter(i => i.value);

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ height: '100dvh' }} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl max-h-[90dvh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white pr-4">Quick View</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
            <Image src={img} alt={product.name} fill className="object-cover" sizes="(max-width:640px) 90vw, 400px" />
          </div>

          {/* Details */}
          <div className="flex flex-col">
            {(product.category?.name) && <p className="text-xs text-gray-400 uppercase tracking-wide">{product.category.name}</p>}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
              {product.name}{product.localName && <span className="font-normal text-gray-500 dark:text-gray-400 text-base"> ({product.localName})</span>}
            </h3>
            {product.scientificName && <p className="text-xs italic text-gray-400 mt-0.5">{product.scientificName}</p>}

            <div className="mt-3">
              <PriceDisplay product={product} campaignItem={campaignItem} />
            </div>

            {(product.shortDescription || product.description) && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 line-clamp-4">
                {product.shortDescription || product.description}
              </p>
            )}

            {specs.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {specs.map(({ icon: Icon, label, value }, idx) => (
                  <div key={`${label}-${idx}`} className="flex items-start gap-1.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-2.5">
                    <Icon className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link
              href={`/products/${product.slug}`}
              onClick={onClose}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand mt-4 hover:underline"
            >
              View full details <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Footer actions — sticky so they stay reachable regardless of how much description/spec
            content is above, same reasoning as QuotationModal's footer. */}
        <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
          {isLocal ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl shrink-0">
                  <button onClick={() => setQty(q => Math.max(effectiveMoq, q - 1))} className="px-3 py-2.5 text-lg font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">−</button>
                  <span className="px-3 text-sm font-semibold text-gray-900 dark:text-white min-w-[2.5rem] text-center">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="px-3 py-2.5 text-lg font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">+</button>
                </div>
                <button onClick={handleToggleWishlist} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-200 transition-all shrink-0" aria-label="Toggle wishlist">
                  <Heart className={`w-5 h-5 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Button variant="secondary" size="sm" icon={ShoppingCart} onClick={handleAddToCart} className="flex-1">Add to Cart</Button>
                <Button variant="primary" size="sm" icon={Zap} onClick={handleBuyNow} className="flex-1">Buy Now</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={handleToggleWishlist} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-200 transition-all shrink-0" aria-label="Toggle wishlist">
                <Heart className={`w-5 h-5 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              </button>
              <Button variant="primary" size="sm" icon={MessageSquare} onClick={() => setShowQuote(true)} className="flex-1">Request Quotation</Button>
            </div>
          )}
        </div>
      </div>

      <QuotationModal isOpen={showQuote} onClose={() => setShowQuote(false)} product={product} />
    </div>
  );

  return createPortal(content, document.body);
}

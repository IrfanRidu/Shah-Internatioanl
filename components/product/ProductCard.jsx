'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, Heart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useStore } from '@/store/useStore';
import { getEffectivePricing } from '@/lib/utils';
import SeasonLabel from './SeasonLabel';
import PriceDisplay from './PriceDisplay';
import QuickViewModal from './QuickViewModal';
import toast from 'react-hot-toast';

// Batch 20 follow-up (card consistency): campaignItem/campaignBadge are optional — every existing
// caller (grid pages, the 6 regular carousels) keeps working exactly as before by simply not passing
// them. FlashSaleSection.jsx (the campaign strip on the homepage and, via reuse, on product pages
// too) is the only caller that supplies them, having been refactored from its own separate,
// hand-maintained card markup onto this one component — see that file's own comment for why. This
// is what makes "every product card is genuinely identical" a structural guarantee going forward
// rather than something to keep re-verifying by eye: a campaign card and a regular card aren't
// visually similar, they're the literal same rendered component.
export default function ProductCard({ product, campaignItem = null, campaignBadge = null }) {
  const { addItem } = useCart();
  const { isLocal } = useBuyerType();
  const { toggleWishlist, isWishlisted } = useStore();
  const [imgErr, setImgErr] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const img = !imgErr && product.images?.[0] ? product.images[0] : 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=400&q=80';
  const wishlisted = isWishlisted(product._id);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // getEffectivePricing(product, null) degrades to the product's own existing discount exactly as
    // before for every non-campaign caller — campaignItem only changes anything when actually
    // supplied. Mirrors what FlashSaleSection's own add-to-cart used to do directly: whichever
    // discount (the product's own, or the campaign's) is bigger is the one charged, matching
    // whichever price PriceDisplay is actually showing on screen.
    const pricing = getEffectivePricing(product, campaignItem);
    const cartProduct = pricing.hasDiscount ? { ...product, discountPrice: pricing.localPrice } : product;
    addItem(cartProduct, 1, !product.isHarvestingSeason);
  };

  const handleQuickView = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickViewOpen(true);
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
    toast.success(wishlisted ? 'Removed from wishlist' : '❤️ Added to wishlist');
  };

  return (
    <>
      {/* Batch 19 (R33-10): was `style={{ width: '170px' }} + flex-shrink-0` — a hardcoded width that
          fought every single one of this component's 8 consumers, EVERY one of which already wraps
          it in their own sizing container (grid columns on the 3 grid-based listing pages, or a
          `flex-shrink-0 w-48/w-52...` div on the 5 carousel-based sections) — the card rendering at a
          fixed 170px regardless of that wrapper's actual width is exactly why cards looked
          inconsistently sized/gapped depending on context. `w-full` makes this component correctly
          fill whatever its caller already sized for it, in every context, uniformly. */}
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
        {/* Top badges — a campaign badge (e.g. "SALE OF THE YEAR") takes priority over the season
            label when both would apply, rather than stacking two badges in the same corner; season
            status is still the more relevant thing to show once a product isn't in an active
            campaign context. */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {campaignBadge ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow" style={{ backgroundColor: campaignBadge.color, color: campaignBadge.textColor }}>
              {campaignBadge.text}
            </span>
          ) : (
            <SeasonLabel isHarvestingSeason={product.isHarvestingSeason} />
          )}
        </div>
        {/* Batch 20 follow-up (issue 3, 4th pass): removed the wishlist + compare corner icons that
            used to sit here, to match the clean, uncluttered reference image — nothing overlaid on
            the photo except the season badge, which conveys actual product status (in-season vs.
            pre-order) rather than being a user-preference control the way wishlist/compare are.
            5th pass: wishlist itself is back (see the button next to Add/Quote below), just moved off
            the image rather than reintroduced here — keeps the clean image intact while still being a
            single, direct tap from the card. Compare remains not reachable from the card — still
            available on the full product page — that trade-off wasn't asked to be reversed. */}
        {/* Batch 20 follow-up (issue 2): this used to repeat whichever action button (Add to Cart /
            Quote / Pre-Order) was ALREADY shown, unhoverable, right below in the info section —
            the exact same action shown twice at once on hover. Replaced with a single Quick View
            trigger that opens a modal covering everything the user asked for (description, specs,
            add to cart, buy now, wishlist, quantity) without leaving the current page — see
            QuickViewModal.jsx. */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3">
          <button onClick={handleQuickView} className="text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg transition-all flex items-center gap-1 bg-gray-900/90 hover:bg-gray-900">
            <Eye className="w-3 h-3" /> Quick View
          </button>
        </div>
      </div>

      {/* Info — flex column so every card in a row ends up the same total height, and the button is
          always pinned to the bottom via mt-auto instead of being clipped by a too-small fixed height.
          Batch 20 follow-up: dropped the category-name line that used to sit above the product name —
          FlashSaleSection.jsx's card (the confirmed "perfect" reference) doesn't have one, and with it
          gone the text block is shorter, which is what actually let the image read as photo-forward
          rather than squeezed — the image's own ratio was already correct (aspect-[15/14], matching
          that reference exactly), the surrounding text block was still taking up enough of the card's
          total height to make the whole thing feel boxier than intended. Padding matched to p-2 (was
          p-2.5) and the name's spacing to mb-1 (was mt-0.5) for the same reason — closer to that
          reference's actual spacing, not just its image ratio. */}
      <div className="p-2 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight mb-1.5 line-clamp-2" style={{ minHeight: '2.25rem' }}>
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
          <PriceDisplay product={product} size="sm" campaignItem={campaignItem} />
          {/* Batch 20 follow-up (issue 3, 4th pass): matches the reference's button precisely —
              near-black (not the site's brand green) and fully rounded, rather than the previous
              rounded-lg/brand-color styling. This is the one genuinely new visual decision in this
              pass, made deliberately rather than by continuing to assume the existing brand color
              should stay untouched: the user has now pointed at this exact reference image twice,
              a black pill button both times, so it's treated as an explicit choice rather than an
              incidental detail of whichever campaign happened to be shown. The Quote button below
              (international buyers) is intentionally left blue — that colour distinction (a
              "get in touch" action reads differently from a "buy" action) wasn't part of what was
              being corrected here.
              5th pass: added the wishlist button here (not back on the image) so it stays a single,
              direct tap from the card without reintroducing the corner-icon clutter the reference
              image didn't have. Same outline-button/filled-heart-icon treatment as Quick View's own
              wishlist button, for visual consistency between the two surfaces. */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onClick={handleWishlist}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              className={`shrink-0 p-2 rounded-full border transition-all ${wishlisted ? 'border-red-200 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-red-200'}`}
            >
              <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
            </button>
            {isLocal ? (
              <button onClick={handleAddToCart} className="flex-1 py-2 rounded-full text-xs font-semibold text-white transition-all hover:opacity-90 bg-gray-900 dark:bg-black">
                {product.isHarvestingSeason ? '🛒 Add' : '⏰ Pre-Order'}
              </button>
            ) : (
              <Link href={`/products/${product.slug}#quotation`} onClick={e => e.stopPropagation()} className="flex-1 block py-2 rounded-full text-xs font-semibold text-center text-white bg-blue-600 hover:bg-blue-700 transition-all">
                💬 Quote
              </Link>
            )}
          </div>
        </div>
      </div>
      </Link>
      <QuickViewModal isOpen={quickViewOpen} onClose={() => setQuickViewOpen(false)} product={product} campaignItem={campaignItem} />
    </>
  );
}

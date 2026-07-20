'use client';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import Image from 'next/image';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useCart } from '@/contexts/CartContext';
import PriceDisplay from '@/components/product/PriceDisplay';

gsap.registerPlugin(ScrollTrigger);

/**
 * Renders a single campaign (the model is still called FlashSale internally,
 * but the admin-facing name is "Campaign" — see /admin/flash-sales).
 *
 * Fully respects every admin-set branding field:
 *   backgroundColor, textColor, badgeText, badgeColor, badgTextColor, displayName, bannerImage
 * — previously this component ignored all of them and always rendered a
 * hardcoded red gradient with the raw `sale.title`, which is why campaign
 * customization appeared to "not work" / "take default layout".
 *
 * Product cards auto-scroll horizontally once there are more products than
 * fit on screen; auto-scroll pauses on hover/touch and the user can always
 * scroll manually or use the left/right arrow buttons.
 */
export default function FlashSaleSection({ sale }) {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const { isLocal } = useBuyerType();
  const { addItem } = useCart();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!sectionRef.current || !sale) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(sectionRef.current, { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 85%' },
      });
    });
    return () => ctx.revert();
  }, [sale]);

  // Auto-scroll the product track once it overflows its container
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf;
    const speed = 0.6;
    let pos = track.scrollLeft;

    const step = () => {
      if (!paused && track.scrollWidth > track.clientWidth) {
        pos += speed;
        if (pos >= track.scrollWidth - track.clientWidth) pos = 0;
        track.scrollLeft = pos;
      } else {
        pos = track.scrollLeft;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused, sale]);

  if (!sale) return null;
  const now = new Date();
  if (new Date(sale.endTime) < now || !sale.isActive) return null;

  const products = (sale.items || [])
    .filter(item => item.product)
    .map(item => ({ ...item.product, price: item.salePrice, discountPrice: null }));

  if (products.length === 0) return null;

  // ── Admin-set branding (with safe fallbacks) ──────────────────────────
  const bg = sale.backgroundColor || '#1a1a2e';
  const textColor = sale.textColor || '#ffffff';
  const badgeText = sale.badgeText || 'SALE';
  const badgeColor = sale.badgeColor || '#ef4444';
  const badgeTextColor = sale.badgTextColor || '#ffffff';
  const displayName = sale.displayName || sale.title || 'Flash Sale';

  const scroll = (dir) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    addItem(product, 1, !product.isHarvestingSeason);
  };

  return (
    <section ref={sectionRef} className="py-8 mx-4 md:mx-auto max-w-7xl">
      <div className="rounded-3xl overflow-hidden relative" style={{ backgroundColor: bg }}>
        {sale.bannerImage && (
          <div className="absolute inset-0 opacity-15">
            <Image src={sale.bannerImage} alt="" fill className="object-cover" sizes="100vw" />
          </div>
        )}
        <div className="p-6 md:p-8 relative">
          {/* Header — badge + name + countdown, all admin-customizable */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl p-2.5" style={{ backgroundColor: `${badgeColor}33` }}>
                <Zap className="w-6 h-6" style={{ color: badgeColor }} fill={badgeColor} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: badgeColor, color: badgeTextColor }}>
                    {badgeText}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: textColor, fontFamily: 'Playfair Display, serif' }}>
                  {displayName}
                </h2>
                {sale.description && <p className="text-sm opacity-80" style={{ color: textColor }}>{sale.description}</p>}
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-1">
              <p className="text-sm font-medium uppercase tracking-wider opacity-70" style={{ color: textColor }}>Ends In</p>
              <CountdownTimer endTime={sale.endTime} />
            </div>
          </div>

          {/* Product track — auto-scrolls, pauses on hover/touch, manual scroll + arrows always available */}
          <div
            className="relative group/track"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setTimeout(() => setPaused(false), 1500)}
          >
            <div ref={trackRef} className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-1" style={{ scrollbarWidth: 'none' }}>
              {products.map((p, i) => (
                <Link
                  key={i}
                  href={`/products/${p.slug}`}
                  className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden flex-shrink-0 relative"
                  style={{ width: '150px' }}
                >
                  {/* Campaign badge on the product card */}
                  <div className="absolute top-1.5 left-1.5 z-10">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow" style={{ backgroundColor: badgeColor, color: badgeTextColor }}>
                      {badgeText}
                    </span>
                  </div>
                  <div className="relative bg-gray-100" style={{ height: '140px' }}>
                    {p.images?.[0] && <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="150px" />}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1" style={{ minHeight: '2rem' }}>{p.name}</p>
                    <PriceDisplay product={p} size="sm" />
                    {isLocal && (
                      <button onClick={(e) => handleAddToCart(e, p)} className="mt-1.5 w-full py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: badgeColor }}>
                        🛒 Add
                      </button>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Manual nav arrows — always available */}
            {products.length > 3 && (
              <>
                <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 bg-white shadow-lg rounded-full p-2 opacity-0 group-hover/track:opacity-100 transition-opacity z-20 hover:bg-gray-50">
                  <ChevronLeft className="w-4 h-4 text-gray-700" />
                </button>
                <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 bg-white shadow-lg rounded-full p-2 opacity-0 group-hover/track:opacity-100 transition-opacity z-20 hover:bg-gray-50">
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

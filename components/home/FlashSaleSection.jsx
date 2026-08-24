'use client';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Image from 'next/image';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';

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
 *
 * Batch 20 follow-up (card consistency): the individual product cards used to be this component's
 * own hand-maintained markup — a separate copy of everything ProductCard.jsx already implements
 * (image, name, price, buy button, badges), at its own fixed 150px width. Every round of feedback on
 * "the product cards look wrong" meant updating ProductCard.jsx and then remembering to separately
 * re-apply the same change here, and the two drifted out of sync more than once over the course of
 * that (a hardcoded rounded-lg black-ish button here, a differently-rounded green one there — not
 * because either was "wrong" in isolation, just because they were two different pieces of code
 * describing what should have been one design). Now renders the actual ProductCard component, passed
 * this campaign's own item (for correct sale pricing — see ProductCard's campaignItem prop) and badge
 * styling (for the "SALE OF THE YEAR"-style pill, via campaignBadge) — a campaign card and a regular
 * card are now structurally guaranteed identical, not just visually matched by hand. Width standardized
 * to w-52 md:w-60, matching the majority of the site's other carousels (see the note in
 * ProductCarouselSection.jsx) rather than keeping its own different w-48/w-56-adjacent 150px value.
 */
export default function FlashSaleSection({ sale }) {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
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

  // Issue 9: don't blindly overwrite the product's price with the campaign's salePrice — a product
  // can already have its own (better) discount. Keep the product untouched and carry the campaign
  // item alongside it; PriceDisplay's campaignItem prop (now reached via ProductCard) picks whichever
  // discount is bigger.
  const campaignEntries = (sale.items || []).filter(item => item.product);

  if (campaignEntries.length === 0) return null;

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

  return (
    <section ref={sectionRef} className="py-8 mx-4 md:mx-auto max-w-7xl">
      <div className="rounded-3xl overflow-hidden relative" style={{ backgroundColor: bg }}>
        {sale.bannerImage && (
          <div className="absolute inset-0 opacity-15">
            <Image src={sale.bannerImage} alt={`${sale.name} campaign banner`} fill className="object-cover" sizes="100vw" />
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
              {campaignEntries.map((entry, i) => (
                <div key={i} className="flex-shrink-0 w-52 md:w-60">
                  <ProductCard
                    product={entry.product}
                    campaignItem={entry}
                    campaignBadge={{ text: badgeText, color: badgeColor, textColor: badgeTextColor }}
                  />
                </div>
              ))}
            </div>

            {/* Manual nav arrows — always available */}
            {campaignEntries.length > 3 && (
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

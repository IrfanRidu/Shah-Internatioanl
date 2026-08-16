'use client';
import { useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// Batch 18 (R32): renders `promotional` and `side` banners — the codebase has never established a
// visual distinction between these two types (no sidebar exists anywhere on the site that would
// give "side" a literal meaning), so rather than inventing a speculative, unconfirmed distinction,
// both render identically through this one shared strip. Used on the homepage (after Categories)
// and the products page (near the top) — see each page for how banners are fetched/filtered by
// position before being passed in here. Renders nothing when given an empty array, so a site with
// none configured for a given page sees no gap.
//
// `bare`: the homepage renders this as its own standalone section (own max-w-7xl container/
// padding/vertical spacing, default `bare=false`). The products page already has its own
// max-w-7xl/px-4 wrapper around its whole layout — nesting another one inside it would double up
// the horizontal padding and make the strip look narrower/indented compared to the product grid
// right below it, so it passes `bare` to render just the card grid with no extra container.
export default function PromoBannerStrip({ banners = [], bare = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || banners.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.7,
        scrollTrigger: { trigger: ref.current, start: 'top 88%' },
      });
    });
    return () => ctx.revert();
  }, [banners.length]);

  if (banners.length === 0) return null;

  const grid = (
    <div className={`grid gap-5 ${banners.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
      {banners.map(b => {
        const card = (
          <div
            className="group relative rounded-2xl overflow-hidden h-48 md:h-56 flex items-end"
            style={{ backgroundColor: b.backgroundColor || '#14532d' }}
          >
            <Image src={b.image} alt={b.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)' }} />
            <div className="relative z-10 p-5 md:p-6 w-full">
              {b.subtitle && <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: b.textColor || '#86efac' }}>{b.subtitle}</p>}
              <h3 className="text-xl md:text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>{b.title}</h3>
              {b.description && <p className="text-sm text-white/80 mb-3 max-w-md">{b.description}</p>}
              {(b.buttonText || b.link) && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  {b.buttonText || 'Learn More'} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </div>
          </div>
        );
        return b.link ? (
          <Link key={b._id} href={b.link} className="block">{card}</Link>
        ) : (
          <div key={b._id}>{card}</div>
        );
      })}
    </div>
  );

  if (bare) return <div ref={ref} className="mb-6">{grid}</div>;

  return (
    <section ref={ref} className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {grid}
      </div>
    </section>
  );
}

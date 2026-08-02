'use client';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ProductCard from '@/components/product/ProductCard';
import Carousel from '@/components/ui/Carousel';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// Generic product-carousel homepage section — same visual language as FeaturedProducts.jsx (kept
// separate/untouched since it has its own established class hooks), reused for issue 13's new
// Currently Harvesting / Available for Pre-Order / per-Category sections instead of copy-pasting
// this markup three-plus times. gsap.context(fn, sectionRef) scopes the '.pcs-header' selector to
// THIS instance's own subtree, so rendering several of these side by side (one per category) never
// cross-animates another instance's header.
export default function ProductCarouselSection({ eyebrow, title, subtitle, products = [], viewAllHref }) {
  const sectionRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.pcs-header', { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  if (!products.length) return null;

  return (
    <section ref={sectionRef} className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pcs-header flex items-end justify-between mb-8">
          <div>
            {eyebrow && <p className="text-sm font-semibold tracking-widest text-brand uppercase mb-2">{eyebrow}</p>}
            <h2 className="section-title mb-1">{title}</h2>
            {subtitle && <p className="text-gray-500">{subtitle}</p>}
          </div>
          {viewAllHref && (
            <Link href={viewAllHref} className="hidden md:flex items-center gap-2 text-brand font-semibold hover:gap-3 transition-all">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        <Carousel showArrows autoplay>
          {products.map(p => (
            <div key={p._id} className="flex-shrink-0 w-52 md:w-60">
              <ProductCard product={p} />
            </div>
          ))}
        </Carousel>
        {viewAllHref && (
          <Link href={viewAllHref} className="mt-6 flex items-center justify-center gap-2 text-brand font-semibold md:hidden">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </section>
  );
}

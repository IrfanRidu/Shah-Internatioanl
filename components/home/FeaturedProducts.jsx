'use client';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ProductCard from '@/components/product/ProductCard';
import Carousel from '@/components/ui/Carousel';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function FeaturedProducts({ products = [] }) {
  const sectionRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.feat-header', { opacity: 0, y: 30 }, {
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
        <div className="feat-header flex items-end justify-between mb-8">
          <div>
            <p className="text-sm font-semibold tracking-widest text-brand uppercase mb-2">Handpicked</p>
            <h2 className="section-title mb-1">Featured Products</h2>
            <p className="text-gray-500">Our most popular farm-fresh selections</p>
          </div>
          <Link href="/products?featured=true" className="hidden md:flex items-center gap-2 text-brand font-semibold hover:gap-3 transition-all">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <Carousel showArrows autoplay>
          {products.map(p => (
            <div key={p._id} className="flex-shrink-0 w-52 md:w-60">
              <ProductCard product={p} />
            </div>
          ))}
        </Carousel>
        <Link href="/products?featured=true" className="mt-6 flex items-center justify-center gap-2 text-brand font-semibold md:hidden">
          View All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

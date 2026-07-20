'use client';
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ProductCard from '@/components/product/ProductCard';
import Carousel from '@/components/ui/Carousel';
import Badge from '@/components/ui/Badge';

gsap.registerPlugin(ScrollTrigger);

export default function SpecialSection({ section }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.7,
        scrollTrigger: { trigger: ref.current, start: 'top 85%' },
      });
    });
    return () => ctx.revert();
  }, []);

  if (!section?.isActive || !section?.products?.length) return null;

  return (
    <section ref={ref} className="py-10" style={{ backgroundColor: section.backgroundColor || undefined }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          {section.badge && <Badge variant="primary">{section.badge}</Badge>}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>{section.title}</h2>
            {section.description && <p className="text-gray-500 text-sm">{section.description}</p>}
          </div>
        </div>
        <Carousel showArrows autoplay>
          {section.products.map(p => (
            <div key={p._id} className="flex-shrink-0 w-52 md:w-60">
              <ProductCard product={p} />
            </div>
          ))}
        </Carousel>
      </div>
    </section>
  );
}

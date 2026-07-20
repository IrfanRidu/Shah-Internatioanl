'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function CategorySection({ categories = [] }) {
  const sectionRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.cat-card', { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, stagger: 0.1, duration: 0.6, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const defaultCats = [
    { name: 'Vegetables', slug: 'vegetables', emoji: '🥦', color: '#dcfce7', count: 45 },
    { name: 'Fruits', slug: 'fruits', emoji: '🍎', color: '#fce7f3', count: 32 },
    { name: 'Herbs & Spices', slug: 'herbs-spices', emoji: '🌿', color: '#fef9c3', count: 28 },
    { name: 'Gourds', slug: 'gourds', emoji: '🎃', color: '#fed7aa', count: 15 },
  ];

  const items = categories.length > 0 ? categories : defaultCats;

  return (
    <section ref={sectionRef} className="py-16 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase mb-2">Browse By</p>
          <h2 className="section-title">Product Categories</h2>
          <p className="section-subtitle">Explore our wide range of fresh agricultural produce</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((cat, i) => (
            <Link href={`/categories/${cat.slug}`} key={cat._id || cat.slug}
              className="cat-card group relative overflow-hidden rounded-2xl p-6 text-center transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
              style={{ backgroundColor: cat.color || '#f0fdf4' }}>
              {cat.image ? (
                <div className="relative w-16 h-16 mx-auto mb-3 rounded-xl overflow-hidden group-hover:scale-110 transition-transform duration-300">
                  <Image src={cat.image} alt={cat.name} fill className="object-cover" sizes="64px" />
                </div>
              ) : (
                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">
                  {cat.emoji || '🌱'}
                </div>
              )}
              <h3 className="font-bold text-gray-800 text-base mb-1">{cat.name}</h3>
              {cat.count && <p className="text-sm text-gray-500">{cat.count}+ products</p>}
              <div className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                Explore <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';
import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import StarRating from '@/components/product/StarRating';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// Small flag lookup so real reviews (which only store a plain country name,
// not an emoji) still get a flag shown next to the reviewer's name.
const FLAG_BY_COUNTRY = {
  bangladesh: '🇧🇩', nigeria: '🇳🇬', 'united arab emirates': '🇦🇪', uae: '🇦🇪',
  singapore: '🇸🇬', germany: '🇩🇪', 'united states': '🇺🇸', usa: '🇺🇸',
  'united kingdom': '🇬🇧', uk: '🇬🇧', india: '🇮🇳', pakistan: '🇵🇰',
  malaysia: '🇲🇾', 'saudi arabia': '🇸🇦', qatar: '🇶🇦', france: '🇫🇷',
};
const flagFor = (country) => FLAG_BY_COUNTRY[(country || '').trim().toLowerCase()] || (country ? '🌍' : '');

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState('all');
  const ref = useRef(null);
  const cardRef = useRef(null);

  // Fetch real, admin-approved reviews — replaces the previous hardcoded
  // fake testimonial array entirely.
  useEffect(() => {
    fetch('/api/reviews/featured?limit=12', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setTestimonials(d.testimonials || []))
      .catch(() => setTestimonials([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? testimonials : testimonials.filter(t => t.type === filter);
  const current = filtered[active % Math.max(filtered.length, 1)];

  useEffect(() => {
    if (testimonials.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 80%' } });
    });
    return () => ctx.revert();
  }, [testimonials.length]);

  const goTo = (idx) => {
    gsap.fromTo(cardRef.current, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' });
    setActive(idx);
  };

  useEffect(() => {
    if (filtered.length < 2) return;
    const id = setInterval(() => goTo((active + 1) % filtered.length), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, filtered.length]);

  // Nothing to show yet (no approved reviews) — don't render an empty/fake section.
  if (loading || testimonials.length === 0 || !current) return null;

  return (
    <section ref={ref} className="py-16" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase mb-2">Trusted Worldwide</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>What Our Customers Say</h2>
          <div className="flex items-center justify-center gap-3 mt-4">
            {['all', 'international', 'local'].map(f => (
              <button key={f} onClick={() => { setFilter(f); setActive(0); }} className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${filter === f ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`} style={filter === f ? { backgroundColor: 'var(--color-primary)' } : {}}>
                {f === 'all' ? 'All' : f === 'international' ? '🌍 Importers' : '🇧🇩 Local'}
              </button>
            ))}
          </div>
        </div>
        <div ref={cardRef} className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-8 md:p-10 max-w-3xl mx-auto relative">
          <Quote className="w-12 h-12 text-green-100 dark:text-green-900 absolute top-6 right-6" />
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
              {current.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-900 dark:text-white">{current.name}</p>
                {current.isVerified && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Verified Buyer</span>}
                {flagFor(current.country) && <span className="text-lg">{flagFor(current.country)}</span>}
              </div>
              <p className="text-sm text-gray-500">
                {current.role}{current.company ? ` · ${current.company}` : ''}{current.product ? ` · re: ${current.product}` : ''}
              </p>
              <StarRating rating={current.rating || 5} size="sm" />
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed italic">&ldquo;{current.text}&rdquo;</p>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <div className="flex gap-2">
              {filtered.map((_, i) => (
                <button key={i} onClick={() => goTo(i)} className={`w-2 h-2 rounded-full transition-all ${i === active % filtered.length ? 'w-6 bg-brand' : 'bg-gray-200'}`} />
              ))}
            </div>
            {filtered.length > 1 && (
              <div className="flex gap-2">
                <button onClick={() => goTo((active - 1 + filtered.length) % filtered.length)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => goTo((active + 1) % filtered.length)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

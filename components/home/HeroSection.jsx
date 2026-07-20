'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MorphingBackground from '@/components/animations/MorphingBackground';
import CountUp from '@/components/animations/CountUp';
import { ArrowRight, MessageSquare, ShoppingBag, Leaf, Globe, Award, Star, Truck } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection({ banners = [] }) {
  const { isLocal, setShowModal } = useBuyerType();
  const { settings } = useSettings();
  const heroRef = useRef(null);
  const badgeRef = useRef(null);
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const ctaRef = useRef(null);
  const statsRef = useRef(null);
  const floatsRef = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(badgeRef.current, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6 })
        .fromTo(titleRef.current.children, { opacity: 0, y: 60, skewY: 3 }, { opacity: 1, y: 0, skewY: 0, stagger: 0.12, duration: 0.8 }, '-=0.3')
        .fromTo(subRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
        .fromTo(ctaRef.current.children, { opacity: 0, y: 20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, stagger: 0.1, duration: 0.5 }, '-=0.3')
        .fromTo(statsRef.current.children, { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.4 }, '-=0.2');

      // Floating emojis
      floatsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(el, { opacity: 0, scale: 0 }, { opacity: 0.25, scale: 1, duration: 0.8, delay: 1 + i * 0.15, ease: 'back.out(2)' });
        gsap.to(el, { y: `${i % 2 === 0 ? -18 : 18}`, rotate: `${i % 2 === 0 ? 8 : -8}`, repeat: -1, yoyo: true, duration: 3 + i * 0.4, ease: 'sine.inOut', delay: i * 0.3 });
      });

      // Scroll parallax on hero
      ScrollTrigger.create({
        trigger: heroRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
        onUpdate: (self) => {
          gsap.set(titleRef.current, { y: self.progress * 60 });
          gsap.set(subRef.current, { y: self.progress * 40 });
        },
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  // Admin-editable via Settings → Hero tab (settings.heroStats). Falls back
  // to sensible defaults if the admin hasn't customized them yet. Icons are
  // matched by label so admin-added stats still get a relevant icon; unknown
  // labels fall back to the Leaf icon.
  const ICONS_BY_LABEL = { Countries: Globe, Products: Leaf, Years: Star, Certifications: Award };
  const defaultStats = [
    { label: 'Countries', value: '35+' },
    { label: 'Products', value: '120+' },
    { label: 'Years', value: '15+' },
    { label: 'Certifications', value: '8' },
  ];
  const rawStats = settings?.heroStats?.length ? settings.heroStats : defaultStats;
  const stats = rawStats.map(s => {
    const match = String(s.value).match(/^(\d+)(\D*)$/);
    return {
      label: s.label,
      end: match ? parseInt(match[1], 10) : 0,
      suffix: match ? match[2] : '',
      icon: ICONS_BY_LABEL[s.label] || Leaf,
    };
  });

  const contact = { phone: '+8801681896498', whatsapp: '8801681896498', ...(settings?.contact || {}) };

  const emojis = ['🥦', '🍅', '🌽', '🥕', '🍋', '🫑', '🥬', '🫚'];

  return (
    <section ref={heroRef} className="relative min-h-[92vh] flex items-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #052e16 0%, #14532d 35%, #166534 65%, #1a5c35 100%)' }}>
      <MorphingBackground />

      {/* Floating emojis */}
      {emojis.map((emoji, i) => (
        <div key={i} ref={el => floatsRef.current[i] = el}
          className="absolute text-4xl md:text-6xl select-none pointer-events-none hidden md:block"
          style={{ left: `${[8,82,12,88,3,92,18,76][i]}%`, top: `${[12,18,72,62,45,38,28,55][i]}%` }}>
          {emoji}
        </div>
      ))}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="max-w-3xl">
          {/* Badge */}
          <div ref={badgeRef} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-green-300 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Leaf className="w-4 h-4" />
            100% Farm Fresh · Bangladesh Origin · Export Grade
          </div>

          {/* Title */}
          <h1 ref={titleRef} className="text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.05]" style={{ fontFamily: 'Playfair Display, serif' }}>
            <span className="block">Premium Farm</span>
            <span className="block" style={{ color: '#86efac' }}>Fresh Exports</span>
            <span className="block text-3xl md:text-4xl font-normal text-white/70 mt-2">to the World</span>
          </h1>

          <p ref={subRef} className="text-lg md:text-xl text-gray-300 mb-8 max-w-xl leading-relaxed">
            {isLocal
              ? 'Order the freshest vegetables and fruits directly to your doorstep. Harvested today, delivered tomorrow.'
              : 'Source premium-quality fresh produce directly from Bangladesh\'s finest farms. HACCP certified, export-ready packaging.'}
          </p>

          <div ref={ctaRef} className="flex flex-wrap gap-4 mb-14">
            {isLocal ? (
              <>
                <Link href="/products" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white text-base transition-all hover:-translate-y-0.5 hover:shadow-2xl" style={{ backgroundColor: 'var(--color-accent)' }}>
                  <ShoppingBag className="w-5 h-5" /> Shop Now <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/categories" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white border-2 border-white/30 hover:bg-white/10 transition-all">
                  Browse Categories
                </Link>
              </>
            ) : (
              <>
                <Link href="/products" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white text-base transition-all hover:-translate-y-0.5 hover:shadow-2xl" style={{ backgroundColor: 'var(--color-accent)' }}>
                  <MessageSquare className="w-5 h-5" /> Get Quotation <ArrowRight className="w-4 h-4" />
                </Link>
                <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white bg-[#25D366] hover:bg-[#22c55e] transition-all hover:-translate-y-0.5">
                  💬 WhatsApp Us
                </a>
              </>
            )}
            <button onClick={() => setShowModal(true)} className="px-5 py-4 rounded-xl text-sm font-medium text-white/60 hover:text-white border border-white/20 hover:border-white/40 transition-all">
              🔄 Switch Mode
            </button>
          </div>

          {/* Stats with CountUp */}
          <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map(({ label, end, suffix, icon: Icon }) => (
              <div key={label} className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl px-4 py-3.5 hover:bg-white/12 transition-all">
                <Icon className="w-4 h-4 text-green-400 mb-1.5" />
                <div className="text-2xl font-bold text-white">
                  <CountUp end={end} suffix={suffix} duration={2.5} />
                </div>
                <p className="text-green-300/70 text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-white/40 text-xs">Scroll</span>
        <div className="w-5 h-8 border border-white/30 rounded-full flex items-start justify-center p-1">
          <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-[bounce_1.5s_infinite]" />
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 leading-none">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-10 md:h-16">
          <path d="M0,60 C480,10 960,10 1440,60 L1440,60 L0,60 Z" fill="rgb(240,253,244)" />
        </svg>
      </div>
    </section>
  );
}

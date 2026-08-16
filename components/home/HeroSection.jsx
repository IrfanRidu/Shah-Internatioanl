'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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

  // Batch 18 (R32): this was the actual reported bug — `banners` was accepted as a prop but never
  // referenced anywhere below, so an admin-uploaded hero banner never had any effect on what
  // rendered here, no matter what. Only the first (lowest displayOrder, already sorted by the
  // query that produced this prop) active hero banner is used — one hero banner replaces the
  // default section entirely, matching "hero banner should replace the default hero section"; a
  // rotation between several concurrent hero banners would be a bigger, separate feature.
  const activeBanner = banners?.[0] || null;

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      // Batch 18: badgeRef/subRef are now conditionally rendered too (a banner's subtitle/
      // description are optional fields) — guarded the same way statsRef already is below, since
      // the default hero always has every one of these but the banner-driven hero might not.
      if (badgeRef.current) tl.fromTo(badgeRef.current, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6 });
      tl.fromTo(titleRef.current.children, { opacity: 0, y: 60, skewY: 3 }, { opacity: 1, y: 0, skewY: 0, stagger: 0.12, duration: 0.8 }, '-=0.3');
      if (subRef.current) tl.fromTo(subRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4');
      tl.fromTo(ctaRef.current.children, { opacity: 0, y: 20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, stagger: 0.1, duration: 0.5 }, '-=0.3');
      if (statsRef.current) {
        tl.fromTo(statsRef.current.children, { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.4 }, '-=0.2');
      }

      // Floating emojis — default hero only, activeBanner has its own real image instead.
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
          if (subRef.current) gsap.set(subRef.current, { y: self.progress * 40 });
        },
      });
    }, heroRef);
    return () => ctx.revert();
  }, [activeBanner]);

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

  // Batch 18 (R32): banner-driven hero — full replacement of the default content below, used
  // whenever the admin has an active hero banner. Keeps the same badge/title/subtitle/CTA/scroll-
  // indicator structure (and the same GSAP refs/animation above) for visual and motion continuity
  // with the rest of the site, rather than looking like a bolted-on, unrelated block.
  if (activeBanner) {
    const bg = activeBanner.backgroundColor || '#052e16';
    const textColor = activeBanner.textColor || '#ffffff';
    return (
      <section ref={heroRef} className="relative min-h-[92vh] flex items-center overflow-hidden" style={{ backgroundColor: bg }}>
        <Image
          src={activeBanner.image}
          alt={activeBanner.title}
          fill
          priority
          sizes="100vw"
          className={`object-cover ${activeBanner.mobileImage ? 'hidden sm:block' : ''}`}
        />
        {activeBanner.mobileImage && (
          <Image src={activeBanner.mobileImage} alt={activeBanner.title} fill priority sizes="100vw" className="object-cover sm:hidden" />
        )}
        {/* Scrim for text readability over an arbitrary admin-uploaded photo */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.15) 100%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="max-w-3xl">
            {activeBanner.subtitle && (
              <div ref={badgeRef} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium px-4 py-2 rounded-full mb-6" style={{ color: textColor }}>
                <Leaf className="w-4 h-4" /> {activeBanner.subtitle}
              </div>
            )}
            <h1 ref={titleRef} className="text-5xl md:text-7xl font-bold mb-6 leading-[1.05]" style={{ fontFamily: 'Playfair Display, serif', color: textColor }}>
              <span className="block">{activeBanner.title}</span>
            </h1>
            {activeBanner.description && (
              <p ref={subRef} className="text-lg md:text-xl mb-8 max-w-xl leading-relaxed" style={{ color: textColor, opacity: 0.85 }}>
                {activeBanner.description}
              </p>
            )}
            <div ref={ctaRef} className="flex flex-wrap gap-4 mb-14">
              <Link href={activeBanner.link || '/products'} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white text-base transition-all hover:-translate-y-0.5 hover:shadow-2xl" style={{ backgroundColor: 'var(--color-accent)' }}>
                <ShoppingBag className="w-5 h-5" /> {activeBanner.buttonText || 'Shop Now'} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator — same as the default hero, kept for visual consistency */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-white/40 text-xs">Scroll</span>
          <div className="w-5 h-8 border border-white/30 rounded-full flex items-start justify-center p-1">
            <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-[bounce_1.5s_infinite]" />
          </div>
        </div>
      </section>
    );
  }

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

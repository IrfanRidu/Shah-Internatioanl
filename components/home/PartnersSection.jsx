'use client';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

export default function PartnersSection() {
  const { settings } = useSettings();
  const trackRef = useRef(null);
  const [paused, setPaused] = useState(false);

  const partners = (settings?.partners || []).filter(p => p.isActive !== false && (p.name || p.logo));
  const doubled = [...partners, ...partners]; // duplicate list so the scroll loops seamlessly

  useEffect(() => {
    const track = trackRef.current;
    if (!track || partners.length < 2) return;
    let pos = 0;
    const speed = 0.5;
    let raf;

    const step = () => {
      if (!paused) {
        pos += speed;
        if (pos >= track.scrollWidth / 2) pos = 0;
        track.style.transform = `translateX(-${pos}px)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [partners.length, paused]);

  if (partners.length === 0) return null;

  return (
    <section className="py-10 border-y border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Trusted By</p>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
          Our Partners & Buyers
        </h2>
      </div>

      <div
        className="overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setTimeout(() => setPaused(false), 1000)}
      >
        <div ref={trackRef} className="flex items-center gap-12 will-change-transform" style={{ width: 'max-content' }}>
          {doubled.map((partner, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
              {partner.logo
                ? <img
                    src={partner.logo}
                    alt={partner.name || `Partner ${i}`}
                    className="h-12 w-auto max-w-[120px] object-contain grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100"
                  />
                : <div className="h-12 flex items-center px-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {partner.name}
                  </div>
              }
              {partner.name && partner.logo && (
                <p className="text-xs text-gray-400 text-center whitespace-nowrap max-w-[100px] truncate">{partner.name}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

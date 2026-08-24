'use client';
import { useSettings } from '@/contexts/SettingsContext';

export default function PartnersSection() {
  const { settings } = useSettings();

  const partners = (settings?.partners || []).filter(p => p.isActive !== false && (p.name || p.logo));
  // Batch 19 (R33-2): only duplicate (for a seamless 50%-translate loop) when there's enough real
  // content to loop meaningfully — a single partner duplicated once would just show the same logo
  // twice, side by side, statically.
  const canLoop = partners.length >= 2;
  const doubled = canLoop ? [...partners, ...partners] : partners;
  // Roughly-consistent visual speed regardless of how many partners the admin has configured —
  // a fixed duration would make a short list crawl and a long list fly by. ~4s per logo, with a
  // floor so a short list still gets a readable/graceful loop.
  const duration = Math.max(15, partners.length * 4);

  if (partners.length === 0) return null;

  return (
    <section className="py-10 border-y border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Trusted By</p>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
          Our Partners & Buyers
        </h2>
      </div>

      {/* Batch 20 follow-up: was pausing on hover/touch (a common, reasonable "let me read this
          logo" affordance in principle) — but on mobile, simply SCROLLING PAST this section is
          itself a touch-drag gesture that passes right through its bounding box, firing
          onTouchStart -> pause on essentially every scroll near it, then onTouchEnd -> resume a
          second later, over and over as the page is scrolled. animation-play-state toggling doesn't
          reset progress, but frequent-enough pausing before the track visibly moves far each time
          reads exactly like "stops and restarts" rather than one continuous sweep — matches the
          reported symptom precisely, and the user asked for it to never stop sliding at all, so the
          pause behavior (and the state it required) is removed entirely rather than tuned. */}
      <div className="overflow-hidden">
        {/* Batch 19 (R33-2): pure CSS keyframe loop now (see globals.css's partners-marquee
            comment for the full root-cause explanation) — was a requestAnimationFrame loop that
            manually tracked a pixel position and reset it against track.scrollWidth read fresh
            every frame; plain <img> tags without explicit dimensions don't report their real size
            until they've actually finished loading, so scrollWidth kept growing as each logo
            loaded in, and the "halfway" reset point kept shifting with it — the track would scroll
            a little, hit a too-early reset, jump back, scroll a little further next time before
            hitting the next (now slightly-more-correct) reset, and so on, which is what looked like
            it kept restarting instead of flowing continuously. translateX(-50%) is resolved against
            the track's own current width at paint time, continuously — not a value captured once
            in JS — so it's correct immediately and stays correct no matter when images finish
            loading. Batch 20 follow-up: no animationPlayState any more — always running, per the
            comment on the wrapper div above. partners.length < 2: no meaningful loop to animate —
            content is just the one logo. */}
        <div
          className="flex items-center gap-12 will-change-transform"
          style={{
            width: 'max-content',
            animation: canLoop ? `partners-marquee ${duration}s linear infinite` : 'none',
          }}
        >
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

'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Carousel({ children, autoplay = false, showArrows = true, showDots = false, className = '' }) {
  const scrollRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef(null);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const width = scrollRef.current.offsetWidth;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -width * 0.8 : width * 0.8, behavior: 'smooth' });
  };

  // One autoplay "tick": scroll right, or loop back to the start once the row has reached its end —
  // so a campaign/product row with more cards than fit on screen keeps cycling instead of just
  // stopping dead once it hits the last card.
  const tick = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (atEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: el.offsetWidth * 0.8, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (!autoplay || paused) return;
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [autoplay, paused, tick]);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  // Pause immediately on hover (mouse) or touch so autoplay never yanks a card away mid-read; resume a
  // short while after the user lets go rather than instantly (a quick tap/mouse-pass-through shouldn't
  // restart scrolling while they're still looking) — but not paused forever either.
  const pauseNow = () => {
    if (resumeTimer.current) { clearTimeout(resumeTimer.current); resumeTimer.current = null; }
    setPaused(true);
  };
  const resumeSoon = (delay = 1200) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), delay);
  };

  // NAMED group ("group/carousel"), not the plain "group" — this wrapper only needs group-hover for
  // its OWN arrow buttons below. Each card rendered as `children` (ProductCard) has its own plain,
  // unnamed `group`/`group-hover:` for its own image-zoom/overlay effect. Plain Tailwind group-hover
  // is a bare CSS descendant selector (`.group:hover .group-hover\:x`) that matches ANY `.group`
  // ancestor at ANY depth, not just the nearest one — so if this wrapper ALSO used the plain/unnamed
  // "group" class, hovering anywhere inside it (including the gaps between cards, or these arrow
  // buttons) would make the browser treat THIS element as :hover too, which would then satisfy that
  // same bare selector for every card's OWN group-hover styles simultaneously — every card in the row
  // lighting up together instead of just the one actually under the cursor. Keeping this wrapper on
  // a named group avoids colliding with any plain/unnamed group nested inside it, from this component
  // or any future one — only group-hover/carousel: (used below) responds to hovering this wrapper.
  return (
    <div
      className={`relative group/carousel ${className}`}
      onMouseEnter={pauseNow}
      onMouseLeave={() => resumeSoon(200)}
      onTouchStart={pauseNow}
      onTouchEnd={() => resumeSoon(1500)}
    >
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {children}
      </div>
      {showArrows && (
        <>
          {/* Always visible on touch/small screens (no real hover state to reveal them there);
              fade in on hover for desktop pointer users, matching the previous look. */}
          <button
            onClick={() => { pauseNow(); scroll('left'); resumeSoon(2500); }}
            aria-label="Scroll left"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 bg-white shadow-lg rounded-full p-2 opacity-100 md:opacity-0 md:group-hover/carousel:opacity-100 transition-opacity z-10 hover:bg-gray-50"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={() => { pauseNow(); scroll('right'); resumeSoon(2500); }}
            aria-label="Scroll right"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 bg-white shadow-lg rounded-full p-2 opacity-100 md:opacity-0 md:group-hover/carousel:opacity-100 transition-opacity z-10 hover:bg-gray-50"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </>
      )}
    </div>
  );
}

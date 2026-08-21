'use client';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { gsap } from 'gsap';
import { X, ChevronLeft, ChevronRight, ZoomIn, Download } from 'lucide-react';

export default function ImageLightbox({ images = [], initialIndex = 0, isOpen, onClose, altPrefix = 'Image' }) {
  const [current, setCurrent] = useState(initialIndex);
  const [zoom, setZoom] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portals need a client-side document.body reference, which doesn't exist
  // during SSR — this flag ensures we only portal after mount.
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => { setCurrent(initialIndex); }, [initialIndex]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    // Animate opacity/scale on an INNER wrapper only — never on the
    // `position: fixed` overlay itself. GSAP leaves the final transform
    // value as a residual inline style after a tween completes, and a
    // `transform` on a `position: fixed` element creates a new CSS
    // containing block for its own descendants, which is what was causing
    // the image to render clipped/offset ("appears half") instead of
    // centered in the viewport.
    gsap.fromTo('.lightbox-overlay', { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
    gsap.fromTo('.lightbox-inner', { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.4)', clearProps: 'transform' });
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const prev = useCallback(() => { setZoom(false); setCurrent(c => (c - 1 + images.length) % images.length); }, [images.length]);
  const next = useCallback(() => { setZoom(false); setCurrent(c => (c + 1) % images.length); }, [images.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (!isOpen) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, prev, next, onClose]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      className="lightbox-overlay fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      style={{ height: '100dvh' }}
      onClick={onClose}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button onClick={e => { e.stopPropagation(); setZoom(!zoom); }} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white backdrop-blur-sm transition-all" title="Toggle zoom">
          <ZoomIn className="w-5 h-5" />
        </button>
        <a href={images[current]} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white backdrop-blur-sm transition-all" title="Download">
          <Download className="w-5 h-5" />
        </a>
        <button onClick={onClose} className="p-2.5 bg-white/10 hover:bg-red-500/80 rounded-xl text-white backdrop-blur-sm transition-all" title="Close (Esc)">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full text-white text-sm font-medium">
        {current + 1} / {images.length}
      </div>

      {/* Main image — a single flex-centered box, no nested absolute/fixed
          positioning chain, so there's nothing for a stray transform to break. */}
      <div
        className="lightbox-inner flex items-center justify-center"
        style={{
          width: 'min(90vw, 1100px)',
          height: 'min(80dvh, 800px)',
          transform: zoom ? 'scale(1.5)' : 'scale(1)',
          transition: 'transform 0.3s ease',
          cursor: zoom ? 'zoom-out' : 'zoom-in',
        }}
        onClick={e => { e.stopPropagation(); setZoom(!zoom); }}
      >
        <img
          src={images[current]}
          alt={`${altPrefix} - photo ${current + 1}`}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px', display: 'block' }}
        />
      </div>

      {/* Navigation */}
      {images.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white backdrop-blur-sm transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={e => { e.stopPropagation(); next(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white backdrop-blur-sm transition-all">
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-2xl max-w-[90vw] overflow-x-auto" onClick={e => e.stopPropagation()}>
          {images.map((img, i) => (
            <button key={i} onClick={() => { setZoom(false); setCurrent(i); }} className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${i === current ? 'border-brand scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              <Image src={img} alt={`${altPrefix} thumbnail ${i + 1}`} fill className="object-cover" sizes="48px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Portal directly to document.body — this is what guarantees the lightbox
  // is always positioned relative to the actual viewport, no matter what
  // GSAP animations, CSS transforms, or overflow rules exist on any parent
  // component in the tree (e.g. the product page's own scroll-in animations).
  return createPortal(content, document.body);
}

'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X } from 'lucide-react';

// Batch 18 (R32): renders the first active `popup`-type banner (if any) as a dismissible overlay.
// Deliberately NOT built on components/ui/Modal.jsx — that component's title-bar-plus-padded-body
// style is for admin settings forms, not an edge-to-edge marketing image. Appears ~1.2s after
// mount so it never competes with the very first paint. Dismissal is remembered per BANNER ID (not
// a single global flag) via sessionStorage, so creating a new popup banner later still shows it
// even if an older one was already dismissed earlier in the same browser session — and it shows
// again on the next session entirely, which is standard marketing-popup behavior.
export default function BannerPopup({ banners = [] }) {
  const banner = banners?.[0] || null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!banner) return;
    const dismissedKey = `si-popup-dismissed-${banner._id}`;
    try {
      if (sessionStorage.getItem(dismissedKey)) return;
    } catch {}
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, [banner]);

  const dismiss = () => {
    setVisible(false);
    if (banner) {
      try { sessionStorage.setItem(`si-popup-dismissed-${banner._id}`, '1'); } catch {}
    }
  };

  if (!banner || !visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
        <button onClick={dismiss} aria-label="Close" className="absolute top-3 right-3 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="relative w-full h-48">
          <Image src={banner.image} alt={banner.title} fill sizes="448px" className="object-cover" />
        </div>
        <div className="p-6 text-center" style={{ backgroundColor: banner.backgroundColor || undefined }}>
          {banner.subtitle && <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-brand">{banner.subtitle}</p>}
          <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: banner.textColor || undefined }}>{banner.title}</h3>
          {banner.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{banner.description}</p>}
          {banner.link && (
            <Link href={banner.link} onClick={dismiss} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:-translate-y-0.5" style={{ backgroundColor: 'var(--color-accent)' }}>
              {banner.buttonText || 'Shop Now'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

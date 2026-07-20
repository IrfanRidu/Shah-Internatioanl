'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { gsap } from 'gsap';
import { MapPin, Globe, CheckCircle2, Leaf, X } from 'lucide-react';

export default function BuyerTypeModal() {
  const { showModal, setShowModal, setBuyerType, initialized } = useBuyerType();
  const { t } = useLanguage();
  const modalRef = useRef(null);
  const overlayRef = useRef(null);
  const cardsRef = useRef([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // useLayoutEffect (not useEffect) so GSAP sets the "from" state (opacity:0,
  // scaled down) synchronously before the browser paints. With useEffect, the
  // browser can paint one frame at full opacity/scale before GSAP runs, which
  // is what made the popup "not appear smoothly" — a visible jump/flash.
  //
  // `mounted` is also a dependency here, not just `showModal`: for a
  // first-time visitor, BuyerTypeContext can set showModal=true before this
  // component's own post-mount effect has flipped `mounted` to true. If that
  // happens, this effect fires once while the modal is still returning null
  // (refs are null, nothing to animate), and then — since showModal itself
  // doesn't change again — never re-fires once mounted catches up and the
  // modal actually renders, so it appears with no animation at all. Watching
  // `mounted` too makes the effect re-run at that point and find real refs.
  useLayoutEffect(() => {
    if (!showModal || !mounted || !modalRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(modalRef.current, { opacity: 0, scale: 0.92, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)', clearProps: 'transform' });
    gsap.fromTo(cardsRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, stagger: 0.12, delay: 0.15, duration: 0.4, ease: 'power3.out', clearProps: 'transform' });
  }, [showModal, mounted]);

  // Close on Escape — only once the user already has a buyer type (don't let
  // a brand-new visitor escape out of the mandatory first-time choice).
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e) => { if (e.key === 'Escape' && initialized) setShowModal(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showModal, initialized, setShowModal]);

  // Once the user has ANY buyer type set (from a previous visit, their
  // account, or just now), this dialog is just the "switch mode" dialog and
  // should always be dismissable by clicking outside it. This was the bug:
  // previously it read localStorage directly and only closed if that
  // happened to already be set — clicking outside right after opening (e.g.
  // an accidental click on the header's "Switch mode" button) could leave it
  // stuck open with no way to dismiss without picking an option.
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && initialized) setShowModal(false);
  };

  if (!showModal || !mounted) return null;

  const content = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', height: '100dvh' }}
      onClick={handleBackdropClick}
    >
      <div ref={modalRef} className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="gradient-brand p-8 text-center text-white relative">
          {/* Close button — only shown once the user already has a buyer type set */}
          {initialized && (
            <button onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Leaf className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>Welcome to Shah International</h1>
          <p className="text-white/80">Please tell us where you are located to show the best experience</p>
        </div>

        {/* Cards */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button ref={el => cardsRef.current[0] = el} onClick={() => setBuyerType('local')}
            className="group text-left border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:border-green-500 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-500 transition-colors">
              <MapPin className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
            </div>
            <div className="text-3xl mb-1">🇧🇩</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Bangladesh Buyer</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Order fresh vegetables & fruits with home delivery across Bangladesh</p>
            <div className="space-y-2">
              {['Prices in BDT (৳)', 'Home delivery available', 'Pay online or Cash on Delivery'].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />{f}
                </div>
              ))}
            </div>
            <div className="mt-4 py-2 px-4 rounded-xl text-sm font-semibold text-white text-center transition-all" style={{ backgroundColor: 'var(--color-primary)' }}>
              I'm in Bangladesh →
            </div>
          </button>

          <button ref={el => cardsRef.current[1] = el} onClick={() => setBuyerType('international')}
            className="group text-left border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:border-blue-500 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
              <Globe className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <div className="text-3xl mb-1">🌍</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">International Buyer / Importer</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Import bulk fresh produce from Bangladesh for your global business</p>
            <div className="space-y-2">
              {['Price range in USD ($)', 'Bulk import & export', 'Direct quotation & WhatsApp'].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />{f}
                </div>
              ))}
            </div>
            <div className="mt-4 py-2 px-4 rounded-xl text-sm font-semibold text-white text-center bg-blue-600 transition-all">
              I'm Outside Bangladesh →
            </div>
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 pb-4">You can switch between modes anytime from the header</p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

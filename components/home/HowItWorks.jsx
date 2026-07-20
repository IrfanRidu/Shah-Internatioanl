'use client';
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sprout, Package, Plane, HandshakeIcon } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const LOCAL_STEPS = [
  { icon: Sprout, title: 'Browse & Select', desc: 'Choose from 100+ seasonal fresh products', color: '#dcfce7', iconColor: '#16a34a' },
  { icon: Package, title: 'Place Your Order', desc: 'Add to cart and checkout securely in minutes', color: '#dbeafe', iconColor: '#2563eb' },
  { icon: Plane, title: 'We Pack & Dispatch', desc: 'Freshly packed and handed to delivery partner', color: '#fef3c7', iconColor: '#d97706' },
  { icon: HandshakeIcon, title: 'Delivered to You', desc: 'Fresh at your door within 24-48 hours', color: '#f3e8ff', iconColor: '#7c3aed' },
];

const INTL_STEPS = [
  { icon: Sprout, title: 'Explore Products', desc: 'Browse our export-grade fresh produce catalogue', color: '#dcfce7', iconColor: '#16a34a' },
  { icon: Package, title: 'Request Quotation', desc: 'Send RFQ with quantity, packaging, destination', color: '#dbeafe', iconColor: '#2563eb' },
  { icon: Plane, title: 'We Arrange Export', desc: 'Phytosanitary certs, custom packaging, logistics', color: '#fef3c7', iconColor: '#d97706' },
  { icon: HandshakeIcon, title: 'Receive Shipment', desc: 'HACCP-certified cargo delivered globally', color: '#f3e8ff', iconColor: '#7c3aed' },
];

export default function HowItWorks({ isLocal = true }) {
  const ref = useRef(null);
  const steps = isLocal ? LOCAL_STEPS : INTL_STEPS;

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.how-step', { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.15, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 80%' } });
      gsap.fromTo('.how-connector', { scaleX: 0 }, { scaleX: 1, stagger: 0.15, duration: 0.5, delay: 0.3, ease: 'power2.out', scrollTrigger: { trigger: ref.current, start: 'top 80%' } });
    }, ref);
    return () => ctx.revert();
  }, [isLocal]);

  return (
    <section ref={ref} className="py-16 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase mb-2">Simple Process</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
            {isLocal ? 'How to Order' : 'How to Import'}
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            {isLocal ? 'Fresh produce at your doorstep in 4 simple steps' : 'From Bangladesh farms to your global warehouse'}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 relative">
          {steps.map(({ icon: Icon, title, desc, color, iconColor }, i) => (
            <div key={i} className="relative">
              <div className="how-step flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-sm" style={{ backgroundColor: color }}>
                    <Icon className="w-8 h-8" style={{ color: iconColor }} />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold flex items-center justify-center shadow">
                    {i + 1}
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-sm md:text-base">{title}</h3>
                <p className="text-xs md:text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="how-connector hidden md:block absolute top-8 left-[calc(50%+32px)] right-[calc(-50%+32px)] h-0.5 bg-gradient-to-r from-gray-200 to-gray-100 origin-left" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

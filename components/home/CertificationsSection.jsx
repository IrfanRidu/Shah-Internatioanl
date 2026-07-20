'use client';
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Shield, CheckCircle } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

gsap.registerPlugin(ScrollTrigger);

// Shown only as a fallback until the admin adds real certifications via
// Settings → Certifications. Once settings.certifications has any entries,
// those completely replace this list.
const DEFAULT_CERTS = [
  { name: 'HACCP', description: 'Hazard Analysis Critical Control Point', icon: '' },
  { name: 'GlobalG.A.P', description: 'Good Agricultural Practice', icon: '' },
  { name: 'ISO 22000', description: 'Food Safety Management', icon: '' },
  { name: 'Organic', description: 'Organic Certification', icon: '' },
];

export default function CertificationsSection() {
  const ref = useRef(null);
  const { settings } = useSettings();

  const certs = (settings?.certifications?.length
    ? settings.certifications.filter(c => c.isActive !== false)
    : DEFAULT_CERTS
  ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  useEffect(() => {
    if (certs.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.cert-card', { opacity: 0, scale: 0.9, y: 20 }, { opacity: 1, scale: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'back.out(1.3)', scrollTrigger: { trigger: ref.current, start: 'top 80%' } });
    }, ref);
    return () => ctx.revert();
  }, [certs.length]);

  if (certs.length === 0) return null;

  return (
    <section ref={ref} className="py-14 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase mb-2">Quality Assured</p>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Certifications & Compliance</h2>
          <p className="text-gray-500 max-w-xl mx-auto">All our products meet international food safety and quality standards for global export</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {certs.map((cert, i) => (
            <div key={i} className="cert-card text-center p-4 rounded-2xl border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-gray-50 dark:bg-gray-900">
              {cert.icon ? (
                <img src={cert.icon} alt={cert.name} className="w-10 h-10 mx-auto mb-2 object-contain" />
              ) : (
                <Shield className="w-8 h-8 mx-auto mb-2 text-brand" />
              )}
              <p className="font-bold text-gray-900 dark:text-white text-sm mb-0.5">{cert.name}</p>
              {cert.description && <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{cert.description}</p>}
              <div className="flex items-center justify-center gap-1 mt-2 text-green-700 text-xs">
                <CheckCircle className="w-3 h-3" /><span>Certified</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

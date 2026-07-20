'use client';
import Link from 'next/link';
import { Leaf, Mail, Phone, MapPin, Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

// Fallback values shown only until Settings loads or if the admin hasn't
// filled these in yet — once settings.contact.* has a value, that always wins.
const FALLBACK = { phone: '+8801681896498', whatsapp: '8801681896498', email: 'shahinternational@gmail.com', address: 'Dhaka, Bangladesh' };

export default function Footer() {
  const { settings } = useSettings();
  const contact = { ...FALLBACK, ...(settings?.contact || {}) };
  const siteTitle = settings?.siteTitle || 'Shah International';
  const siteDescription = settings?.siteDescription || 'Premium farm-fresh vegetables and fruits, exported from Bangladesh to the world with quality and care.';
  const social = settings?.social || {};

  return (
    <footer className="bg-gray-900 text-gray-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-lg">{siteTitle}</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">{siteDescription}</p>
            <div className="flex gap-3">
              {[
                { Icon: Facebook, href: social.facebook },
                { Icon: Instagram, href: social.instagram },
                { Icon: Linkedin, href: social.linkedin },
                { Icon: Youtube, href: social.youtube },
              ].filter(s => s.href).map(({ Icon, href }, i) => (
                <a key={i} href={href} className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-green-700 transition-all">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {[['/', 'Home'], ['/products', 'All Products'], ['/categories', 'Categories'], ['/about', 'About Us'], ['/contact', 'Contact']].map(([href, label]) => (
                <li key={href}><Link href={href} className="hover:text-green-400 transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* For Importers */}
          <div>
            <h4 className="text-white font-semibold mb-4">For Importers</h4>
            <ul className="space-y-2 text-sm">
              {[['#', 'Request Quotation'], ['#', 'Export Process'], ['#', 'Certifications'], ['#', 'Packaging Options'], ['#', 'Shipping & Logistics']].map(([href, label]) => (
                <li key={label}><a href={href} className="hover:text-green-400 transition-colors">{label}</a></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><Phone className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /><a href={`tel:${contact.phone}`} className="hover:text-green-400 transition-colors">{contact.phone}</a></li>
              <li className="flex items-start gap-2"><Mail className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /><a href={`mailto:${contact.email}`} className="hover:text-green-400 transition-colors">{contact.email}</a></li>
              <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /><span>{contact.address}</span></li>
            </ul>
            <div className="mt-4 p-3 bg-green-900/30 rounded-lg border border-green-800">
              <p className="text-xs text-green-400 font-medium mb-1">📱 WhatsApp</p>
              <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noreferrer" className="text-white text-sm hover:text-green-400 transition-colors">+{contact.whatsapp}</a>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-800 py-5 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Shah International. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy-policy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms of Service</Link>
            <Link href="/refund-policy" className="hover:text-gray-300 transition-colors">Refund Policy</Link>
            <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="hover:text-gray-300 transition-colors">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { Leaf, Globe, Award, Users } from 'lucide-react';

export const metadata = { title: 'About Us' };

export default async function AboutPage() {
  let settings = {};
  try { await connectDB(); settings = (await Settings.findOne().lean()) || {}; } catch {}
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>About Shah International</h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">{settings.siteTagline || 'Farm Fresh. Global Reach.'}</p>
      </div>
      <div className="prose prose-green max-w-none mb-12">
        <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">{settings.aboutUs || 'Shah International is a leading agro-export company based in Bangladesh, dedicated to providing premium quality farm-fresh vegetables, fruits, and herbs to global markets. With over 15 years of experience, we connect Bangladesh\'s finest farmers with buyers worldwide.'}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        {[{ icon: Globe, label: '35+ Countries', desc: 'Global reach' }, { icon: Leaf, label: '120+ Products', desc: 'Fresh produce' }, { icon: Award, label: '8 Certifications', desc: 'Quality assured' }, { icon: Users, label: '5000+ Clients', desc: 'Worldwide' }].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="text-center p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--color-primary)', opacity: 0.1 }}>
              <Icon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{label}</p>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

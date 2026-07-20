'use client';
import { useState } from 'react';
import { Mail, Phone, MapPin, MessageSquare } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const { settings } = useSettings();
  const contact = { phone: '+8801681896498', whatsapp: '8801681896498', email: 'shahinternational@gmail.com', address: 'Dhaka, Bangladesh', ...(settings?.contact || {}) };
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Message sent! We\'ll respond within 24 hours.');
    setForm({ name: '', email: '', subject: '', message: '' });
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Contact Us</h1>
        <p className="text-gray-500 text-lg">Get in touch with our team for orders, quotes, or partnerships</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div>
          <div className="space-y-5 mb-8">
            {[
              { icon: Phone, label: 'Phone / WhatsApp', value: contact.phone, href: `tel:${contact.phone}` },
              { icon: Mail, label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
              { icon: MapPin, label: 'Address', value: contact.address, href: null },
              { icon: MessageSquare, label: 'WhatsApp', value: 'Chat with us', href: `https://wa.me/${contact.whatsapp}` },
            ].map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  {href ? <a href={href} className="font-semibold text-gray-800 dark:text-white hover:text-brand transition-colors">{value}</a> : <p className="font-semibold text-gray-800 dark:text-white">{value}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Send a Message</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" />
            <Input label="Email" type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.com" />
            <Input label="Subject" required value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="How can we help?" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Message <span className="text-red-500">*</span></label>
              <textarea rows={5} required value={form.message} onChange={e => set('message', e.target.value)} className="input-field resize-none" placeholder="Tell us about your requirements..." />
            </div>
            <Button type="submit" variant="primary" className="w-full" size="lg" loading={loading}>Send Message</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

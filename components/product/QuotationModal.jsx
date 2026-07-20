'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useSettings } from '@/contexts/SettingsContext';
import { X, Mail, MessageSquare, Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';

export default function QuotationModal({ isOpen, onClose, product }) {
  const { data: session } = useSession();
  const { settings } = useSettings();
  const contact = { whatsapp: '8801681896498', email: 'shahinternational@gmail.com', ...(settings?.contact || {}) };
  const exportEmail = contact.exportEmail || contact.email;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', country: '', quantity: '', message: '' });
  const [mounted, setMounted] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { setMounted(true); }, []);

  // Pre-fill from session
  useEffect(() => {
    if (session?.user) {
      setForm(p => ({ ...p, name: session.user.name || '', email: session.user.email || '' }));
    }
  }, [session]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.quantity) { toast.error('Name, email and quantity are required'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, product: product?.name }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Quotation request sent! We will contact you within 24 hours.'); onClose(); }
      else toast.error(data.message || 'Failed to send');
    } catch { toast.error('Network error — please try again'); }
    finally { setLoading(false); }
  };

  const whatsappLink = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(`Hi Shah International, I'd like to request a quotation for:\n\nProduct: ${product?.name}\nQuantity: ${form.quantity || 'TBD'}\nCompany: ${form.company || 'N/A'}\nCountry: ${form.country || 'N/A'}`)}`;

  const content = (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ height: '100dvh' }} role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel — centred, max 640px, scrollable if needed */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Request Import Quotation</h2>
            {product?.name && <p className="text-sm text-gray-500 mt-0.5">for <span className="font-semibold text-brand">{product.name}</span></p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <div className="p-6 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name" required placeholder="Your full name" value={form.name} onChange={e => set('name', e.target.value)} />
            <Input label="Email Address" required type="email" placeholder="your@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
            <Input label="Phone / WhatsApp" placeholder="+1 234 567 8900" value={form.phone} onChange={e => set('phone', e.target.value)} />
            <Input label="Company Name" placeholder="Your company (optional)" value={form.company} onChange={e => set('company', e.target.value)} />
            <Input label="Country" required placeholder="Your country" value={form.country} onChange={e => set('country', e.target.value)} />
            <Input label="Required Quantity" required placeholder="e.g. 500 kg, 5 tons, 10 CTN" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Additional Requirements</label>
              <textarea
                value={form.message}
                onChange={e => set('message', e.target.value)}
                rows={3}
                placeholder="Packaging preferences, delivery timeline, certifications needed, special handling..."
                className="input-field resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="primary" onClick={handleSubmit} loading={loading} icon={Send} className="flex-1">
              Send Quotation Request
            </Button>
            <a href={whatsappLink} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-[#25D366] hover:bg-[#22c55e] transition-all text-sm flex-1">
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </a>
            <a href={`mailto:${exportEmail}`}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all text-sm flex-1">
              <Mail className="w-4 h-4" /> Email
            </a>
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">We respond to all quotation requests within 24 hours</p>
        </div>
      </div>
    </div>
  );

  // Portal directly to document.body so the modal is always centered relative
  // to the actual viewport, regardless of any transform/overflow/positioning
  // set by ancestor components (e.g. the product page's own animations) —
  // this is what fixes it not "display[ing] fully and properly in the
  // middle of the screen".
  return createPortal(content, document.body);
}

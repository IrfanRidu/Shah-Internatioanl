import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
export const metadata = { title: 'Refund Policy' };
export default async function RefundPolicyPage() {
  let settings = {};
  try { await connectDB(); settings = (await Settings.findOne().lean()) || {}; } catch {}
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>Refund Policy</h1>
      <div className="prose prose-green dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-line">
        {settings.refundPolicy || 'Due to the perishable nature of our fresh produce, we accept return or refund claims within 24 hours of delivery if a product arrives damaged or incorrect. Contact us via WhatsApp or email with photos of the issue, and we will arrange a replacement or refund within 3–5 business days.\n\nProducts returned without prior notice, or claims made beyond the 24-hour window, are not eligible for refund.'}
      </div>
    </div>
  );
}

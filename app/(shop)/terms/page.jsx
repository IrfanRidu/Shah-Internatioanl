import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
export const metadata = { title: 'Terms of Service' };
export default async function TermsPage() {
  let settings = {};
  try { await connectDB(); settings = (await Settings.findOne().lean()) || {}; } catch {}
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>Terms of Service</h1>
      <div className="prose prose-green dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-line">
        {settings.termsAndConditions || 'By using Shah International, you agree to our terms. Products are sold as described. Delivery times may vary. For disputes, contact us at info@shahintl.com.'}
      </div>
    </div>
  );
}

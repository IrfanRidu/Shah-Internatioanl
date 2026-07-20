import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
export const metadata = { title: 'Privacy Policy' };
export default async function PrivacyPolicyPage() {
  let settings = {};
  try { await connectDB(); settings = (await Settings.findOne().lean()) || {}; } catch {}
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>Privacy Policy</h1>
      <div className="prose prose-green dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-line">
        {settings.privacyPolicy || 'We respect your privacy. Your personal information is collected only to process your orders and improve our services. We do not sell your data to third parties.\n\nFor questions, contact us at info@shahintl.com.'}
      </div>
    </div>
  );
}

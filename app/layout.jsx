import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Providers from './providers';
import PwaRegistration from '@/components/PwaRegistration';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import './globals.css';

// This layout reads logo/favicon/title directly from the database on every
// request. Without this, Next.js could statically cache the rendered layout
// (including the favicon/title/logo baked into the initial HTML), so an
// admin's branding change would never show up without a full rebuild —
// this was one of the causes behind "settings changes don't reflect on the
// frontend".
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const viewport = {
  themeColor: '#2d6a4f',
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  title: { default: 'Shah International – Farm Fresh Exports', template: '%s | Shah International' },
  description: 'Premium farm-fresh vegetables and fruits exported globally from Bangladesh.',
  keywords: ['farm fresh', 'Bangladesh export', 'vegetables', 'fruits', 'Shah International', 'halal', 'organic'],
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Shah International' },
  openGraph: { title: 'Shah International', description: 'Farm Fresh. Global Reach.', type: 'website', siteName: 'Shah International' },
  twitter: { card: 'summary_large_image', title: 'Shah International', description: 'Farm Fresh. Global Reach.' },
};

export default async function RootLayout({ children }) {
  const session = await getServerSession(authOptions);

  // Load branding from settings (fails silently — fallback to defaults below)
  let siteLogo = null;
  let siteFavicon = null;
  let siteTitle = 'Shah International';
  try {
    await connectDB();
    const settings = await Settings.findOne().lean();
    if (settings?.logo) siteLogo = settings.logo;
    if (settings?.favicon) siteFavicon = settings.favicon;
    if (settings?.siteTitle) siteTitle = settings.siteTitle;
  } catch {}

  const faviconHref = siteFavicon || '/favicon.png';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
        {/* Favicon — driven by Settings; falls back to /favicon.png */}
        <link rel="icon" type="image/png" href={faviconHref} key="favicon" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={siteTitle} />
        <title>{siteTitle}</title>
      </head>
      <body>
        <Providers session={session} siteLogo={siteLogo} siteTitle={siteTitle}>
          <PwaRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}

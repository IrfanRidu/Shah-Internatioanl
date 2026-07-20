import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Deliberately minimal: this route group exists ONLY to render print-ready shipment documents, so it
// must NOT inherit the admin Sidebar/TopBar (that was the root cause of issue 35 — the website's UI
// bleeding into printed/downloaded documents). It still needs the same admin-only auth gate as the
// rest of the export dashboard, since these documents contain sensitive buyer/financial data — that
// gate has to be re-declared here because moving out from under app/admin/layout.jsx also moves out
// from under its redirect check.
export const metadata = { title: 'Print Document | Shah International' };

export default async function PrintLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session || !['superAdmin', 'admin', 'editor'].includes(session.user.role)) {
    redirect('/login?callbackUrl=/admin/export-dashboard');
  }
  return children;
}

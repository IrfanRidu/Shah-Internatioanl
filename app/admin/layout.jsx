import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Conversation from '@/models/Conversation';
import AdminShell from './AdminShell';

export const metadata = { title: { default: 'Admin Panel | Shah International', template: '%s | Admin' } };

export default async function AdminLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session || !['superAdmin', 'admin', 'editor'].includes(session.user.role)) {
    redirect('/login?callbackUrl=/admin');
  }

  let pendingOrders = 0;
  let unreadMessages = 0;
  try {
    await connectDB();
    // Order.status is never literally 'pending' — the schema's real initial state is 'processing'
    // (processing → confirmed/cancelled → onTheWay → delivered/returned). Querying 'pending' silently
    // matched zero orders forever, which is why this badge/banner never showed anything.
    [pendingOrders, unreadMessages] = await Promise.all([
      Order.countDocuments({ status: 'processing' }),
      Conversation.countDocuments({ unreadByAdmin: true }),
    ]);
  } catch {}

  // Batch 17 (R8): the actual <aside>/<main> markup, plus the mobile drawer + hamburger button
  // that share state with each other, now lives in AdminShell (a client component) — this file
  // stays a server component focused on session/redirect/badge-count work only.
  return (
    <AdminShell session={session} pendingOrders={pendingOrders} unreadMessages={unreadMessages}>
      {children}
    </AdminShell>
  );
}

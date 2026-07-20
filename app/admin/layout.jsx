import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/layout/AdminSidebar';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Conversation from '@/models/Conversation';
import AdminTopBar from './AdminTopBar';

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

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <AdminSidebar pendingOrders={pendingOrders} unreadMessages={unreadMessages} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopBar session={session} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

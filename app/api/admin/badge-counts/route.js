import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Conversation from '@/models/Conversation';

// Cheap, admin-only counts used to keep the sidebar/notification badges live without a full page
// reload (issue 40) — Next.js doesn't re-run a server layout on client-side sibling navigation, so a
// badge computed only in app/admin/layout.jsx would otherwise stay stale until a hard refresh even
// after the underlying order/message was actually handled.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['superAdmin', 'admin', 'editor'].includes(session.user.role)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }
  try {
    await connectDB();
    const [pendingOrders, unreadMessages] = await Promise.all([
      Order.countDocuments({ status: 'processing' }),
      Conversation.countDocuments({ unreadByAdmin: true }),
    ]);
    return NextResponse.json({ success: true, pendingOrders, unreadMessages });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

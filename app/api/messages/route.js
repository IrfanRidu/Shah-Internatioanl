import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import { sendNewMessageEmail } from '@/lib/email';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// GET: list conversations (user sees own, admin sees all / filtered)
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(request.url);
    const isAdmin = ['superAdmin', 'admin', 'editor'].includes(session.user.role);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const query = {};
    if (!isAdmin) query.user = session.user.id;
    if (status && status !== 'all') query.status = status;

    const total = await Conversation.countDocuments(query);
    const conversations = await Conversation.find(query)
      .populate('user', 'name email phone buyerType company country')
      .populate('product', 'name slug images')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, conversations, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST: start a new conversation with first message
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Please login to send a message' }, { status: 401 });
    await connectDB();
    const { subject, body, productId, type } = await request.json();
    if (!subject || !body) return NextResponse.json({ success: false, message: 'Subject and message are required' }, { status: 400 });

    const conversation = await Conversation.create({
      user: session.user.id,
      subject,
      product: productId || undefined,
      type: type || 'general',
      lastMessage: body,
      lastMessageAt: new Date(),
      lastSenderRole: 'user',
      unreadByAdmin: true,
      unreadByUser: false,
    });

    const message = await Message.create({
      conversation: conversation._id,
      sender: session.user.id,
      senderRole: 'user',
      body,
    });

    try {
      await sendNewMessageEmail({ toAdmin: true, userName: session.user.name, userEmail: session.user.email, subject, body, conversationId: conversation._id });
    } catch (e) { console.error('Notify email failed:', e); }

    return NextResponse.json({ success: true, conversation, message }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

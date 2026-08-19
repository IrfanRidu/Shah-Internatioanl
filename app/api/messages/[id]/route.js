import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
// Batch 17 (R9): required by .populate() calls below — see the fuller comment in
// app/(shop)/products/[slug]/page.jsx for why these direct imports are necessary.
import Product from '@/models/Product';
import User from '@/models/User';
import { sendNewMessageEmail } from '@/lib/email';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// GET: fetch a conversation thread
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const isAdmin = ['superAdmin', 'admin', 'editor'].includes(session.user.role);

    const conversation = await Conversation.findById(params.id).populate('user', 'name email phone buyerType company country').populate('product', 'name slug images');
    if (!conversation) return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
    if (!isAdmin && conversation.user._id.toString() !== session.user.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const messages = await Message.find({ conversation: params.id }).sort('createdAt').lean();

    // Mark as read
    if (isAdmin) await Conversation.findByIdAndUpdate(params.id, { unreadByAdmin: false });
    else await Conversation.findByIdAndUpdate(params.id, { unreadByUser: false });

    return NextResponse.json({ success: true, conversation, messages });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST: reply to a conversation
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const isAdmin = ['superAdmin', 'admin', 'editor'].includes(session.user.role);
    const conversation = await Conversation.findById(params.id).populate('user', 'name email');
    if (!conversation) return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
    if (!isAdmin && conversation.user._id.toString() !== session.user.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const { body, attachments } = await request.json();
    // Batch 19 (R33-7): a message now only needs EITHER text OR at least one attachment, not
    // necessarily both — an attachment-only message (no caption) is a normal, valid thing to send.
    if (!body?.trim() && !attachments?.length) {
      return NextResponse.json({ success: false, message: 'Message cannot be empty' }, { status: 400 });
    }

    const senderRole = isAdmin ? 'admin' : 'user';
    const message = await Message.create({ conversation: params.id, sender: session.user.id, senderRole, body: body || '', attachments: attachments || [] });

    // Batch 19 (R33-7): an attachment-only message would otherwise leave the conversation list's
    // preview snippet, and the notification email's body, blank/empty — give both a sensible
    // fallback instead of silently showing nothing.
    const lastMessagePreview = body?.trim() || '📎 Sent an attachment';
    conversation.lastMessage = lastMessagePreview;
    conversation.lastMessageAt = new Date();
    conversation.lastSenderRole = senderRole;
    if (senderRole === 'admin') { conversation.unreadByUser = true; conversation.unreadByAdmin = false; }
    else { conversation.unreadByAdmin = true; conversation.unreadByUser = false; }
    await conversation.save();

    try {
      if (senderRole === 'admin') {
        await sendNewMessageEmail({ toAdmin: false, toEmail: conversation.user.email, toName: conversation.user.name, subject: conversation.subject, body: lastMessagePreview });
      } else {
        await sendNewMessageEmail({ toAdmin: true, userName: session.user.name, userEmail: session.user.email, subject: conversation.subject, body: lastMessagePreview, conversationId: conversation._id });
      }
    } catch (e) { console.error('Notify email failed:', e); }

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PATCH: close/reopen conversation (admin only) or reassign
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['superAdmin', 'admin', 'editor'].includes(session.user.role)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();
    const body = await request.json();
    const conversation = await Conversation.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

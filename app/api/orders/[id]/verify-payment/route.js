import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
// Batch 17 (R9): required by .populate('user', ...) below — see the fuller comment in
// app/(shop)/products/[slug]/page.jsx for why this direct import is necessary.
import User from '@/models/User';
import { hasPermission } from '@/lib/permissions';
import { sendOrderStatusEmail } from '@/lib/email';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// Admin action: confirm (or reject) that a bKash/Nagad Transaction ID a
// customer submitted actually matches a real payment received in the
// store's mobile-banking account. This is the manual verification step
// that closes the loop on "orders placed without paying" for bKash/Nagad,
// since there's no card-style API to auto-verify these transfers with.
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'orders', 'update')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { action, rejectionReason } = await request.json(); // action: 'verify' | 'reject'

    const order = await Order.findById(params.id).populate('user', 'name email');
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    if (!order.paymentVerification?.trxId) {
      return NextResponse.json({ success: false, message: 'This order has no payment submission to verify' }, { status: 400 });
    }

    if (action === 'verify') {
      order.paymentVerification.status = 'verified';
      order.paymentVerification.verifiedBy = session.user.id;
      order.paymentVerification.verifiedAt = new Date();
      order.paymentStatus = 'paid';
      order.statusHistory.push({ status: order.status, note: `Payment verified (${order.paymentMethod} TrxID: ${order.paymentVerification.trxId})`, updatedBy: session.user.id, timestamp: new Date() });
    } else if (action === 'reject') {
      order.paymentVerification.status = 'rejected';
      order.paymentVerification.rejectionReason = rejectionReason || 'Transaction could not be verified';
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      order.statusHistory.push({ status: 'cancelled', note: `Payment verification failed: ${rejectionReason || 'Transaction not found'}`, updatedBy: session.user.id, timestamp: new Date() });
    } else {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }

    await order.save();

    try {
      await sendOrderStatusEmail(order, order.user, action === 'verify' ? 'Payment confirmed' : 'Payment could not be verified');
    } catch (e) { console.error('Email failed:', e); }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

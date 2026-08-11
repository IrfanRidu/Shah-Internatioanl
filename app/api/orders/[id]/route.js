import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import Inventory from '@/models/Inventory';
import { sendOrderStatusEmail } from '@/lib/email';
import { hasPermission, isAdminRole } from '@/lib/permissions';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const order = await Order.findById(params.id).populate('user', 'name email phone').populate('items.product', 'name images slug');
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    const isAdmin = isAdminRole(session);
    if (!isAdmin && order.user._id.toString() !== session.user.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const body = await request.json();
    const order = await Order.findById(params.id).populate('user', 'name email phone');
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    const isAdmin = isAdminRole(session);

    if (!isAdmin) {
      // Order.status is never literally 'pending' (real enum: processing → confirmed → onTheWay →
      // delivered, with cancelled/returned as exits) — this condition was always false, so a customer
      // could never cancel their own order under any circumstances. Allow it while the order hasn't
      // shipped yet (processing or confirmed), matching the Cancel button's visibility condition.
      if (body.status === 'cancelled' && ['processing', 'confirmed'].includes(order.status)) {
        order.status = 'cancelled';
        order.cancelReason = body.cancelReason || 'Cancelled by customer';
        order.cancelledAt = new Date();
        order.statusHistory.push({ status: 'cancelled', note: body.cancelReason || 'Cancelled by customer', updatedBy: session.user.id, timestamp: new Date() });
        for (const item of order.items) {
          await Inventory.findOneAndUpdate({ product: item.product }, { $inc: { reservedStock: -item.quantity } });
        }
      } else {
        return NextResponse.json({ success: false, message: 'Not authorized for this action' }, { status: 403 });
      }
    } else {
      const requiredAction = body.status === 'cancelled' ? 'cancel' : 'update';
      if (!hasPermission(session, 'orders', requiredAction)) {
        return NextResponse.json({ success: false, message: 'You do not have permission to update orders' }, { status: 403 });
      }
      const prevStatus = order.status;
      if (body.status && body.status !== prevStatus) {
        order.status = body.status;
        order.statusHistory.push({ status: body.status, note: body.note || '', updatedBy: session.user.id, timestamp: new Date() });
        if (body.status === 'delivered') {
          order.deliveredAt = new Date();
          order.paymentStatus = order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus;
          for (const item of order.items) {
            await Inventory.findOneAndUpdate({ product: item.product }, { $inc: { currentStock: -item.quantity, reservedStock: -item.quantity } });
          }
        }
        if (body.status === 'cancelled') {
          order.cancelReason = body.note || 'Cancelled by admin';
          order.cancelledAt = new Date();
          for (const item of order.items) {
            await Inventory.findOneAndUpdate({ product: item.product }, { $inc: { reservedStock: -item.quantity } });
          }
        }
        // Send status update email
        try {
          const statusEmailTriggers = ['confirmed', 'processing', 'onTheWay', 'delivered', 'cancelled'];
          if (statusEmailTriggers.includes(body.status) && order.user) {
            await sendOrderStatusEmail(order, order.user, body.status);
          }
        } catch (emailErr) { console.error('Status email failed:', emailErr); }
      }
      if (body.adminNote !== undefined) order.adminNote = body.adminNote;
      if (body.paymentStatus) order.paymentStatus = body.paymentStatus;
      if (body.estimatedDelivery) order.estimatedDelivery = body.estimatedDelivery;
    }

    await order.save();
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

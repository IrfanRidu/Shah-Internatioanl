import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const order = await Order.findById(params.id).populate('user', 'name email phone').lean();
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    const isAdmin = ['superAdmin', 'admin', 'editor'].includes(session.user.role);
    if (!isAdmin && order.user._id.toString() !== session.user.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    // Return order data for client-side PDF generation
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Coupon from '@/models/Coupon';
import { hasPermission, isAdminRole } from '@/lib/permissions';

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'coupons', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const coupon = await Coupon.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'coupons', 'delete')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    await Coupon.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

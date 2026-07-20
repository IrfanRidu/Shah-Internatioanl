import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Coupon from '@/models/Coupon';
import { hasPermission, isAdminRole } from '@/lib/permissions';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'coupons', 'view')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const coupons = await Coupon.find().sort('-createdAt').lean();
    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'coupons', 'create')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const coupon = await Coupon.create(body);
    return NextResponse.json({ success: true, coupon }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

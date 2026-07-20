import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Coupon from '@/models/Coupon';

export async function POST(request) {
  try {
    await connectDB();
    const { code, subtotal } = await request.json();
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return NextResponse.json({ success: false, message: 'Invalid coupon code' }, { status: 400 });
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return NextResponse.json({ success: false, message: 'Coupon has expired' }, { status: 400 });
    }
    if (subtotal < coupon.minimumOrderAmount) {
      return NextResponse.json({ success: false, message: `Minimum order amount is ৳${coupon.minimumOrderAmount}` }, { status: 400 });
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ success: false, message: 'Coupon usage limit reached' }, { status: 400 });
    }
    const discount = coupon.type === 'percentage'
      ? Math.min(subtotal * coupon.value / 100, coupon.maximumDiscount || Infinity)
      : Math.min(coupon.value, subtotal);
    return NextResponse.json({ success: true, coupon: { code: coupon.code, type: coupon.type, value: coupon.value }, discount });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

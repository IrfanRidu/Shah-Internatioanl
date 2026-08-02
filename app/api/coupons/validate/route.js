import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Coupon from '@/models/Coupon';

export async function POST(request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    const { code, subtotal, productIds } = await request.json();
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return NextResponse.json({ success: false, message: 'Invalid coupon code' }, { status: 400 });
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return NextResponse.json({ success: false, message: 'Coupon has expired' }, { status: 400 });
    }
    if (subtotal < coupon.minimumOrderAmount) {
      return NextResponse.json({ success: false, message: `Minimum order amount is ৳${coupon.minimumOrderAmount}` }, { status: 400 });
    }
    // Issue 8: overall usage limit (pre-existing check, unchanged).
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ success: false, message: 'Coupon usage limit reached' }, { status: 400 });
    }
    // Issue 8: per-user usage limit — only checkable for a signed-in user (a guest has no stable
    // identity to key usedBy on); the authoritative, actually-enforced check happens again at order
    // placement in /api/orders (which requires login), so a guest simply won't see this specific
    // message early, but can never exceed the limit either way once they do sign in to check out.
    if (session?.user?.id && coupon.usagePerUser) {
      const priorUse = (coupon.usedBy || []).find(u => String(u.user) === String(session.user.id));
      if (priorUse && priorUse.count >= coupon.usagePerUser) {
        return NextResponse.json({ success: false, message: "You've already used this coupon the maximum number of times" }, { status: 400 });
      }
    }
    // Issue 7: a coupon restricted to specific products only applies when the cart actually
    // contains at least one of them.
    if (coupon.applicableProducts?.length > 0) {
      const ids = Array.isArray(productIds) ? productIds.map(String) : [];
      const eligible = coupon.applicableProducts.some(id => ids.includes(String(id)));
      if (!eligible) {
        return NextResponse.json({ success: false, message: 'This coupon only applies to specific products not currently in your cart' }, { status: 400 });
      }
    }
    const discount = coupon.type === 'percentage'
      ? Math.min(subtotal * coupon.value / 100, coupon.maximumDiscount || Infinity)
      : Math.min(coupon.value, subtotal);
    return NextResponse.json({ success: true, coupon: { code: coupon.code, type: coupon.type, value: coupon.value }, discount });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

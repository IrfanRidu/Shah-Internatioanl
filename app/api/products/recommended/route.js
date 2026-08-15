import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
// Batch 17 (R9): required by .populate('category', ...) below — see the fuller comment in
// app/(shop)/products/[slug]/page.jsx for why this direct import is necessary.
import Category from '@/models/Category';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// "Matches your interests" — genuinely derived from the signed-in buyer's own
// order history (which categories they've actually bought from before), not
// a fabricated recommendation. Guests / buyers with no order history yet fall
// back to featured products from the current product's category, which is
// still a reasonable, honest default rather than a fake personalization claim.
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '8');
    // Accepts one ID or a comma-separated list — backward compatible with existing single-ID callers.
    const excludeIds = (searchParams.get('exclude') || '').split(',').map(s => s.trim()).filter(Boolean);
    const fallbackCategory = searchParams.get('category');
    const buyerType = searchParams.get('buyerType');

    const session = await getServerSession(authOptions);
    let categoryIds = [];

    if (session?.user?.id) {
      const pastOrders = await Order.find({ user: session.user.id, status: { $ne: 'cancelled' } })
        .select('items.product')
        .populate('items.product', 'category')
        .lean();
      const seen = new Set();
      pastOrders.forEach(o => o.items.forEach(i => { if (i.product?.category) seen.add(String(i.product.category)); }));
      categoryIds = [...seen];
    }

    if (categoryIds.length === 0 && fallbackCategory) categoryIds = [fallbackCategory];

    // $ne:false, not ===true — see buildProductQuery's comment in lib/utils.js: a product missing
    // the field entirely must still be eligible for recommendation, not silently excluded.
    const query = {
      isActive: { $ne: false },
      _id: { $nin: excludeIds },
      ...(categoryIds.length ? { category: { $in: categoryIds } } : {}),
    };
    if (buyerType === 'local') query.availableForLocal = { $ne: false };
    if (buyerType === 'international') query.availableForInternational = { $ne: false };

    let products = await Product.find(query)
      .populate('category', 'name slug')
      .sort({ isHarvestingSeason: -1, isFeatured: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // If a logged-in buyer's history didn't yield enough results, top up with
    // general featured products rather than showing a half-empty section.
    if (products.length < limit) {
      const haveIds = products.map(p => p._id);
      const topUp = await Product.find({
        isActive: { $ne: false }, _id: { $nin: [...haveIds, ...excludeIds] }, isFeatured: true,
        ...(buyerType === 'local' ? { availableForLocal: { $ne: false } } : {}),
        ...(buyerType === 'international' ? { availableForInternational: { $ne: false } } : {}),
      }).populate('category', 'name slug').limit(limit - products.length).lean();
      products = [...products, ...topUp];
    }

    return NextResponse.json({ success: true, products, personalized: categoryIds.length > 0 && !!session?.user?.id });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

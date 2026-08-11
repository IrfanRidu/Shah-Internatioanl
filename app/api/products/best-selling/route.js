import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// Public endpoint: real best-sellers computed from actual delivered order
// line items (quantity sold), not a hardcoded or admin-picked list.
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '8');
    // Accepts one ID or a comma-separated list — backward compatible with existing single-ID callers.
    const excludeIds = (searchParams.get('exclude') || '').split(',').map(s => s.trim()).filter(Boolean);

    const topSellers = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', sold: { $sum: '$items.quantity' } } },
      { $sort: { sold: -1 } },
      { $limit: limit + excludeIds.length }, // headroom in case some top sellers are excluded
    ]);

    const ids = topSellers.map(t => t._id).filter(id => !excludeIds.includes(String(id)));
    // $ne:false, not ===true — see buildProductQuery's comment in lib/utils.js: a product missing
    // the field entirely (predates it, or was inserted outside the normal create flow) must still
    // be eligible to appear here, not silently dropped from Best Sellers just because it lacks a
    // field that has nothing to do with whether it actually sold.
    const products = await Product.find({ _id: { $in: ids }, isActive: { $ne: false } })
      .populate('category', 'name slug')
      .lean();

    // Preserve the sales-rank order (Mongo $in doesn't guarantee it)
    const bySold = new Map(topSellers.map(t => [String(t._id), t.sold]));
    const ordered = products
      .sort((a, b) => (bySold.get(String(b._id)) || 0) - (bySold.get(String(a._id)) || 0))
      .slice(0, limit)
      .map(p => ({ ...p, unitsSold: bySold.get(String(p._id)) || 0 }));

    return NextResponse.json({ success: true, products: ordered });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

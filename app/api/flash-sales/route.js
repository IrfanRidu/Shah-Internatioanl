import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import FlashSale from '@/models/FlashSale';
import { hasPermission, isAdminRole } from '@/lib/permissions';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminRole(session);
    // isActive uses $ne:false, not ===true — see lib/utils.js's buildProductQuery for the same
    // reasoning: a campaign missing the field entirely must still be findable here too, same as the
    // homepage/product-page's own equivalent queries (app/(shop)/page.jsx,
    // app/(shop)/products/[slug]/page.jsx).
    // select includes the full pricing field set (price, discountPrice, priceRangeMin,
    // priceRangeMax, unit) — a prior, narrower select here (name/images/slug/availability only)
    // meant any consumer of this route (ActiveCampaignsStrip.jsx's self-fetch fallback) rendered
    // every campaign product at a $0/৳0 price, since getEffectivePricing() had no price fields on
    // the populated product to compute from. Kept in sync with the equivalent direct-Mongoose
    // queries in app/(shop)/page.jsx and app/(shop)/products/[slug]/page.jsx.
    const query = !isAdmin || activeOnly ? { isActive: { $ne: false }, startTime: { $lte: new Date() }, endTime: { $gte: new Date() } } : {};
    const sales = await FlashSale.find(query).populate('items.product', 'name images slug price discountPrice priceRangeMin priceRangeMax unit isHarvestingSeason availableForLocal availableForInternational').sort('-createdAt').lean();
    return NextResponse.json({ success: true, sales });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'flashSales', 'create')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const sale = await FlashSale.create(body);
    return NextResponse.json({ success: true, sale }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
// Batch 17 (R9): required by .populate('category', ...) below — see the fuller comment in
// app/(shop)/products/[slug]/page.jsx for why this direct import is necessary.
import Category from '@/models/Category';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// Same escaping this catalog's other search entry point (buildProductQuery in lib/utils.js) already
// applies — kept as a local copy rather than importing escapeRegex since that helper isn't exported
// from lib/utils.js. Without it, a query containing an unbalanced '(' (extremely common mid-type
// against botanical names like "Mango (Mangifera indica)") throws inside $regex, which the catch
// block below turns into a 500 the storefront's autocomplete box can only show as "no results".
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ success: true, results: [] });
    const safeQ = escapeRegex(q);
    const results = await Product.find({
      // $ne:false, not ===true — same reasoning as buildProductQuery in lib/utils.js: a product
      // missing the field entirely (predates it, or was inserted outside the normal create flow)
      // must still be findable here, not silently excluded from the storefront's own search box.
      isActive: { $ne: false },
      $or: [
        { name: { $regex: safeQ, $options: 'i' } },
        { scientificName: { $regex: safeQ, $options: 'i' } },
        { localName: { $regex: safeQ, $options: 'i' } },
        { tags: { $in: [new RegExp(safeQ, 'i')] } },
      ],
    }).select('name slug images isHarvestingSeason price discountPrice priceRangeMin priceRangeMax unit category')
      .populate('category', 'name')
      .limit(8).lean();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

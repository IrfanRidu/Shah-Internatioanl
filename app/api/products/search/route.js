import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
// Batch 17 (R9): required by .populate('category', ...) below — see the fuller comment in
// app/(shop)/products/[slug]/page.jsx for why this direct import is necessary.
import Category from '@/models/Category';
// Batch 20 (issue 4): reuses the SAME normalize/escape helpers buildProductQuery (the storefront's
// main product-listing search) already uses, instead of this route's own separate copy — so a search
// behaves identically here (header/home autocomplete) and there (case-insensitive, and now also
// tolerant of stray leading/trailing whitespace or punctuation, and of punctuation differences
// between words — see lib/utils.js's own comments on each for the full reasoning).
import { normalizeSearchTerm, buildFlexibleSearchRegexSource } from '@/lib/utils';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const q = normalizeSearchTerm(searchParams.get('q'));
    if (!q || q.length < 2) return NextResponse.json({ success: true, results: [] });
    const safeQ = buildFlexibleSearchRegexSource(q);
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

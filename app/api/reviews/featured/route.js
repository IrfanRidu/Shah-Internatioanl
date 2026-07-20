import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Review from '@/models/Review';

// Public endpoint: returns real, admin-approved reviews for the homepage
// testimonials carousel. This replaces what used to be a hardcoded array of
// fabricated names/quotes — every entry returned here traces back to an
// actual Review document created by a real customer and approved by an admin
// in /admin/reviews.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12');

    const reviews = await Review.find({ isApproved: true, rating: { $gte: 4 } })
      .populate('user', 'name buyerType country company')
      .populate('product', 'name slug')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const testimonials = reviews
      .filter(r => r.comment && r.user) // only well-formed reviews with an actual written comment
      .map(r => ({
        name: r.user?.name || 'Verified Buyer',
        role: r.user?.buyerType === 'international' ? 'Importer' : 'Customer',
        company: r.user?.company || '',
        country: r.user?.country || '',
        text: r.comment,
        rating: r.rating,
        type: r.user?.buyerType || 'local',
        product: r.product?.name,
        isVerified: r.isVerified,
        date: r.createdAt,
      }));

    return NextResponse.json({ success: true, testimonials });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ success: true, results: [] });
    const results = await Product.find({
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { scientificName: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
      ],
    }).select('name slug images isHarvestingSeason price discountPrice priceRangeMin priceRangeMax unit category')
      .populate('category', 'name')
      .limit(8).lean();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

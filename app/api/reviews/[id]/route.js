import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Review from '@/models/Review';
import Product from '@/models/Product';
import { hasPermission } from '@/lib/permissions';

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'reviews', 'moderate')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { isApproved, adminReply } = await request.json();
    const review = await Review.findByIdAndUpdate(params.id, { isApproved, adminReply }, { new: true });
    if (isApproved) {
      const stats = await Review.aggregate([
        { $match: { product: review.product, isApproved: true } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      if (stats[0]) await Product.findByIdAndUpdate(review.product, { averageRating: Math.round(stats[0].avg * 10) / 10, reviewCount: stats[0].count });
    }
    return NextResponse.json({ success: true, review });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'reviews', 'moderate')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    await Review.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

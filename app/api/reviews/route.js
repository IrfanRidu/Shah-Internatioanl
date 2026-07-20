import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Review from '@/models/Review';
import Product from '@/models/Product';
import Order from '@/models/Order';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const session = await getServerSession(authOptions);
    const isAdmin = ['superAdmin', 'admin', 'editor'].includes(session?.user?.role);
    const query = productId ? { product: productId } : {};
    if (!isAdmin) query.isApproved = true;
    const total = await Review.countDocuments(query);
    const reviews = await Review.find(query)
      .populate('user', 'name avatar buyerType')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const stats = productId ? await Review.aggregate([
      { $match: { product: require('mongoose').Types.ObjectId.createFromHexString(productId), isApproved: true } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 }, r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }, r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } }, r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } }, r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } }, r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } } } },
    ]) : [];
    return NextResponse.json({ success: true, reviews, total, page, pages: Math.ceil(total / limit), stats: stats[0] || null });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Please login to submit a review' }, { status: 401 });
    await connectDB();
    const body = await request.json();
    const { productId, rating, title, comment } = body;
    if (!productId || !rating) return NextResponse.json({ success: false, message: 'Product and rating required' }, { status: 400 });
    const existing = await Review.findOne({ product: productId, user: session.user.id });
    if (existing) return NextResponse.json({ success: false, message: 'You have already reviewed this product' }, { status: 400 });
    const order = await Order.findOne({ user: session.user.id, 'items.product': productId, status: 'delivered' });
    const isVerified = !!order;
    const review = await Review.create({
      product: productId, user: session.user.id, order: order?._id,
      rating, title, comment, isVerified,
      isApproved: isVerified,
    });
    if (isVerified) {
      const stats = await Review.aggregate([
        { $match: { product: review.product, isApproved: true } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      if (stats[0]) {
        await Product.findByIdAndUpdate(productId, { averageRating: Math.round(stats[0].avg * 10) / 10, reviewCount: stats[0].count });
      }
    }
    return NextResponse.json({ success: true, review, message: isVerified ? 'Review published!' : 'Review submitted for moderation' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { hasPermission } from '@/lib/permissions';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'analytics', 'view')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ? new Date(searchParams.get('from')) : new Date(Date.now() - 90 * 86400000);
    const to = searchParams.get('to') ? new Date(searchParams.get('to') + 'T23:59:59') : new Date();

    const [customerGrowth, revenueByType, ordersByHour, topCustomers, repeatCustomers] = await Promise.all([
      // Customer registrations per day
      User.aggregate([
        { $match: { role: { $in: ['localBuyer', 'internationalBuyer'] }, createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$buyerType' }, count: { $sum: 1 } } },
        { $sort: { '_id.date': 1 } },
      ]),

      // Revenue by buyer type
      Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to }, status: { $nin: ['cancelled', 'returned'] } } },
        { $group: { _id: '$orderType', revenue: { $sum: '$total' }, orders: { $sum: 1 }, avgOrder: { $avg: '$total' } } },
      ]),

      // Orders by hour of day (heatmap data)
      Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: { hour: { $hour: '$createdAt' }, day: { $dayOfWeek: '$createdAt' } }, count: { $sum: 1 } } },
      ]),

      // Top customers by spend
      Order.aggregate([
        { $match: { status: 'delivered', createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$user', totalSpend: { $sum: '$total' }, orderCount: { $sum: 1 } } },
        { $sort: { totalSpend: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { name: '$user.name', email: '$user.email', phone: '$user.phone', buyerType: '$user.buyerType', totalSpend: 1, orderCount: 1 } },
      ]),

      // Repeat customers
      Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
        { $group: { _id: null, repeat: { $sum: { $cond: [{ $gt: ['$count', 1] }, 1, 0] } }, oneTime: { $sum: { $cond: [{ $eq: ['$count', 1] }, 1, 0] } } } },
      ]),
    ]);

    // Process customer growth into daily series
    const growthMap = {};
    customerGrowth.forEach(g => {
      const date = g._id.date;
      if (!growthMap[date]) growthMap[date] = { date, local: 0, international: 0 };
      growthMap[date][g._id.type] = g.count;
    });
    const dailyGrowth = Object.values(growthMap).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      dailyGrowth,
      revenueByType,
      ordersByHour,
      topCustomers,
      repeatCustomers: repeatCustomers[0] || { repeat: 0, oneTime: 0 },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

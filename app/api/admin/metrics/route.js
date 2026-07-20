import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import Product from '@/models/Product';
import { hasPermission } from '@/lib/permissions';

// All financial analytics are based ONLY on delivered orders (per spec item 12).
// Returned orders deduct the delivery charge from profit automatically.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'analytics', 'view')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');
    const currency = searchParams.get('currency') || 'BDT';

    const dateQuery = {};
    if (dateFrom) dateQuery.$gte = new Date(dateFrom);
    if (dateTo) dateQuery.$lte = new Date(dateTo + 'T23:59:59');
    const baseQuery = Object.keys(dateQuery).length ? { createdAt: dateQuery } : {};

    // ── Only delivered orders count for revenue/profit ──────────────────────
    const deliveredQuery = { ...baseQuery, status: 'delivered' };
    const returnedQuery = { ...baseQuery, status: 'returned' };

    const [
      deliveredOrders,
      returnedOrders,
      totalUsers, localUsers, intlUsers,
      totalProducts, activeProducts,
      processingOrders, newOrders,
      currencyRates,
    ] = await Promise.all([
      Order.find(deliveredQuery).lean(),
      Order.find(returnedQuery).lean(),
      User.countDocuments({ role: { $in: ['localBuyer', 'internationalBuyer'] } }),
      User.countDocuments({ buyerType: 'local' }),
      User.countDocuments({ buyerType: 'international' }),
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments({ status: 'processing' }),
      Order.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/currency`).then(r => r.json()).catch(() => ({ rates: {} })),
    ]);

    const rates = currencyRates.rates || {};
    const rate = (currency === 'BDT' || !rates[currency]) ? 1 : (rates[currency] / (rates.BDT || 1));
    const convert = (bdtAmount) => currency === 'BDT' ? bdtAmount : parseFloat((bdtAmount * rate).toFixed(2));

    // Revenue & profit from delivered orders
    // Issue 41: delivery charge must be EXCLUDED from analytics/profit entirely — it is a pass-through
    // logistics fee, not product margin, and should never be counted as profit. `order.total` bakes
    // deliveryCharge into itself (total = subtotal + deliveryCharge - discount - couponDiscount), so
    // using it as "gross revenue" was silently treating every delivery fee as pure profit. Product
    // revenue must come from `subtotal` instead — the sum of item prices only, with no delivery charge
    // mixed in, in either direction. Delivery charge is tracked separately below purely as an
    // informational operational figure and, per spec, ONLY ever counted as a LOSS when an order is
    // returned (a delivery charge that was paid out/incurred but never converted into a sale).
    const grossRevenue = deliveredOrders.reduce((a, o) => a + (o.subtotal ?? ((o.total || 0) - (o.deliveryCharge || 0))), 0);
    const totalCOGS = deliveredOrders.reduce((a, o) => a + o.items.reduce((b, i) => b + ((i.productCost || 0) * (i.quantity || 0)), 0), 0);
    const totalDiscounts = deliveredOrders.reduce((a, o) => a + (o.discount || 0) + (o.couponDiscount || 0), 0);
    // Informational only — delivery fees collected on delivered orders. NEVER added into
    // grossRevenue/grossProfit/netProfit; delivery charges contribute zero profit by design.
    const deliveryRevenue = deliveredOrders.reduce((a, o) => a + (o.deliveryCharge || 0), 0);

    // Loss: delivery charge of returned orders (per spec item 12 and issue 41) — the ONLY way a
    // delivery charge ever touches profit is as a deduction here, never as a gain anywhere above.
    const returnedDeliveryLoss = returnedOrders.reduce((a, o) => a + (o.deliveryCharge || 0), 0);

    const grossProfit = grossRevenue - totalCOGS;
    const netRevenue = grossRevenue - totalDiscounts;
    const netProfit = grossProfit - returnedDeliveryLoss;
    const aov = deliveredOrders.length > 0 ? grossRevenue / deliveredOrders.length : 0;

    // Revenue by day — delivered only
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: 'delivered' } },
      // Issue 41: revenue = product subtotal only, delivery charge excluded (never counted as profit)
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$subtotal' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Status breakdown (all orders for operational view)
    const statusBreakdown = await Order.aggregate([
      ...(Object.keys(baseQuery).length ? [{ $match: baseQuery }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Top products (delivered only for accurate sales data)
    const topProducts = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', name: { $first: '$items.name' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, sold: { $sum: '$items.quantity' } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    // Revenue by buyer type (delivered only)
    const revenueByType = await Order.aggregate([
      { $match: { status: 'delivered', ...baseQuery } },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDoc' } },
      { $unwind: { path: '$userDoc', preserveNullAndEmpty: true } },
      // Issue 41: revenue = product subtotal only, delivery charge excluded
      { $group: { _id: '$userDoc.buyerType', revenue: { $sum: '$subtotal' }, count: { $sum: 1 } } },
    ]);

    return NextResponse.json({
      success: true,
      currency,
      metrics: {
        // All BDT values converted to requested currency
        grossRevenue: convert(grossRevenue),
        netRevenue: convert(netRevenue),
        grossProfit: convert(grossProfit),
        netProfit: convert(netProfit),
        totalCOGS: convert(totalCOGS),
        totalDiscounts: convert(totalDiscounts),
        deliveryRevenue: convert(deliveryRevenue),
        returnedDeliveryLoss: convert(returnedDeliveryLoss),
        aov: convert(aov),
        orderCount: deliveredOrders.length,
        deliveredCount: deliveredOrders.length,
        returnedCount: returnedOrders.length,
        totalUsers, localUsers, intlUsers,
        totalProducts, activeProducts,
        processingOrders, newOrders,
        dailyRevenue: dailyRevenue.map(d => ({ ...d, revenue: convert(d.revenue) })),
        statusBreakdown,
        topProducts: topProducts.map(p => ({ ...p, revenue: convert(p.revenue) })),
        revenueByType: revenueByType.map(r => ({ ...r, revenue: convert(r.revenue) })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

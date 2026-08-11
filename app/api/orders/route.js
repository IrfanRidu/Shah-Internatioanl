import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Inventory from '@/models/Inventory';
import Coupon from '@/models/Coupon';
import Settings from '@/models/Settings';
import { sendOrderConfirmation } from '@/lib/email';
import User from '@/models/User';
import { hasPermission } from '@/lib/permissions';
import { computeDeliveryCharge } from '@/lib/utils';
import Stripe from 'stripe';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();

    const { searchParams } = new URL(request.url);
    // "See all orders" requires the orders.view permission (always true for
    // superAdmin/admin); everyone else only ever sees their own order history.
    const isAdmin = hasPermission(session, 'orders', 'view');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const query = {};
    if (!isAdmin) query.user = session.user.id;
    if (status && status !== 'all') query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo + 'T23:59:59');
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, orders, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Please login to place order' }, { status: 401 });
    await connectDB();

    const body = await request.json();
    const {
      items, deliveryAddress, paymentMethod, couponCode, notes,
      deliveryZoneName,           // which zone the customer picked at checkout
      trxId, senderNumber,        // required for bkash/nagad
      deliveryChargePaymentIntentId, // required for COD when the admin has enabled prepayment
    } = body;

    // Validate items and get product costs
    const enrichedItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) return NextResponse.json({ success: false, message: `Product ${item.name} not available` }, { status: 400 });
      const price = product.discountPrice || product.price;
      enrichedItems.push({
        product: product._id,
        name: product.name,
        image: product.images?.[0] || '',
        quantity: item.quantity,
        unit: product.unit,
        price,
        productCost: product.productCost || 0,
        isPreOrder: !product.isHarvestingSeason,
      });
      subtotal += price * item.quantity;
    }

    const settings = await Settings.findOne().lean();

    // Delivery charge is ALWAYS computed server-side from the admin's
    // configured zones — never trusted from the client — using the zone the
    // customer selected at checkout (item #29: zones must actually be
    // presented to and chosen by the customer before ordering).
    const { charge: deliveryCharge, zoneName: resolvedZoneName } = computeDeliveryCharge(subtotal, deliveryZoneName, settings);

    // ── Payment method-specific verification (item #28) ──────────────────
    // No payment method may skip straight to a placed order without proof
    // of payment. Stripe (full card payment) is verified separately by the
    // client calling /api/payment/create-intent + confirming the card, then
    // the webhook marks paymentStatus 'paid' — that flow is unaffected here.
    let paymentStatus = 'pending';
    let paymentVerification;
    let deliveryChargePaid = false;

    if (paymentMethod === 'bkash' || paymentMethod === 'nagad') {
      // Manual mobile-banking transfer: customer must have already sent
      // money to the store's bKash/Nagad number and provide proof (TrxID +
      // the phone number they paid from). Without both, the order is
      // rejected outright — this is what actually closes the "can place
      // order without paying" gap for these two methods.
      if (!trxId?.trim() || !senderNumber?.trim()) {
        return NextResponse.json({
          success: false,
          message: `Please send the payment via ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} first, then enter your Transaction ID and the number you paid from.`,
        }, { status: 400 });
      }
      paymentStatus = 'awaiting_verification';
      paymentVerification = { trxId: trxId.trim(), senderNumber: senderNumber.trim(), submittedAt: new Date(), status: 'pending' };
    }

    if (paymentMethod === 'cod' && settings?.payment?.codDeliveryChargeRequired && deliveryCharge > 0) {
      // Admin has required delivery-charge prepayment for COD orders — the
      // customer must have already completed a Stripe PaymentIntent for
      // exactly the delivery charge amount before the order can be placed.
      if (!deliveryChargePaymentIntentId) {
        return NextResponse.json({
          success: false,
          message: 'This store requires the delivery charge to be paid online before placing a Cash on Delivery order.',
        }, { status: 400 });
      }
      const intent = await stripe.paymentIntents.retrieve(deliveryChargePaymentIntentId);
      const expectedAmount = Math.round(deliveryCharge * 100);
      if (intent.status !== 'succeeded' || intent.amount !== expectedAmount) {
        return NextResponse.json({ success: false, message: 'Delivery charge payment could not be verified. Please try again.' }, { status: 400 });
      }
      deliveryChargePaid = true;
      paymentStatus = 'pending'; // product cost itself is still COD; only the delivery fee was prepaid
    }

    // Apply coupon
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (coupon && new Date() >= coupon.validFrom && new Date() <= coupon.validUntil) {
        // Issue 8: this is the AUTHORITATIVE enforcement point (the /api/coupons/validate
        // pre-check while shopping is only ever advisory — nothing stopped a client from placing
        // the order directly, or two requests racing past validate before either had incremented
        // anything). Re-check everything here, right before actually consuming a use.
        const overallOk = !coupon.usageLimit || coupon.usedCount < coupon.usageLimit;
        const priorUse = (coupon.usedBy || []).find(u => String(u.user) === String(session.user.id));
        const perUserOk = !coupon.usagePerUser || !priorUse || priorUse.count < coupon.usagePerUser;
        // Issue 7: a product-restricted coupon only applies when this order actually contains at
        // least one of the products the admin picked for it.
        const eligibleProduct = !coupon.applicableProducts?.length
          || enrichedItems.some(i => coupon.applicableProducts.some(id => String(id) === String(i.product)));
        if (subtotal >= coupon.minimumOrderAmount && overallOk && perUserOk && eligibleProduct) {
          appliedCoupon = coupon.code;
          if (coupon.type === 'percentage') {
            couponDiscount = Math.min(subtotal * coupon.value / 100, coupon.maximumDiscount || Infinity);
          } else {
            couponDiscount = Math.min(coupon.value, subtotal);
          }
          // Track both the overall count and this specific user's own count.
          if (priorUse) {
            await Coupon.findOneAndUpdate(
              { _id: coupon._id, 'usedBy.user': session.user.id },
              { $inc: { usedCount: 1, 'usedBy.$.count': 1 } }
            );
          } else {
            await Coupon.findByIdAndUpdate(coupon._id, {
              $inc: { usedCount: 1 },
              $push: { usedBy: { user: session.user.id, count: 1 } },
            });
          }
        }
      }
    }

    const total = subtotal + deliveryCharge - couponDiscount;
    const order = await Order.create({
      user: session.user.id,
      orderType: body.orderType || 'local',
      items: enrichedItems,
      subtotal,
      deliveryCharge,
      deliveryZoneName: resolvedZoneName,
      couponCode: appliedCoupon,
      couponDiscount,
      total,
      paymentMethod,
      paymentStatus,
      paymentVerification,
      deliveryChargePaymentIntentId: deliveryChargePaid ? deliveryChargePaymentIntentId : undefined,
      deliveryChargePaid,
      deliveryAddress,
      customerNote: notes,
      statusHistory: [{ status: 'processing', note: 'Order placed', timestamp: new Date() }],
    });

    // Update inventory
    for (const item of enrichedItems) {
      await Inventory.findOneAndUpdate({ product: item.product }, { $inc: { reservedStock: item.quantity } });
    }

    // Send confirmation email
    try {
      const user = await User.findById(session.user.id);
      await sendOrderConfirmation(order, user);
    } catch (e) { console.error('Email failed:', e); }

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

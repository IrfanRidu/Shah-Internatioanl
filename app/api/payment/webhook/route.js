import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { sendOrderStatusEmail } from '@/lib/email';
import User from '@/models/User';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  await connectDB();

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const order = await Order.findOneAndUpdate(
        { stripePaymentIntentId: pi.id },
        { paymentStatus: 'paid', status: 'confirmed', stripeChargeId: pi.latest_charge,
          $push: { statusHistory: { status: 'confirmed', note: 'Payment confirmed via Stripe', timestamp: new Date() } } },
        { new: true }
      ).populate('user', 'name email');
      if (order?.user) {
        try { await sendOrderStatusEmail(order, order.user, 'confirmed'); } catch (e) { console.error(e); }
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await Order.findOneAndUpdate(
        { stripePaymentIntentId: pi.id },
        { paymentStatus: 'failed',
          $push: { statusHistory: { status: 'processing', note: 'Payment failed', timestamp: new Date() } } }
      );
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object;
      // 'refunded' is a valid paymentStatus but NOT a valid Order.status value (the real enum has
      // 'returned' for this case) — writing 'refunded' there was saving an invalid/undocumented status.
      await Order.findOneAndUpdate(
        { stripeChargeId: charge.id },
        { paymentStatus: 'refunded', status: 'returned',
          $push: { statusHistory: { status: 'returned', note: 'Refund processed via Stripe', timestamp: new Date() } } }
      );
      break;
    }
  }

  return NextResponse.json({ received: true });
}

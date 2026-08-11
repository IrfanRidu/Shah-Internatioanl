import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { computeDeliveryCharge } from '@/lib/utils';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

// Creates a small Stripe PaymentIntent covering ONLY the delivery charge —
// used when the admin has turned on "require delivery charge payment for
// COD orders" (Settings.payment.codDeliveryChargeRequired). The rest of the
// order (product cost) is still collected in cash at the door as normal.
//
// The charge amount is always recomputed server-side from the selected
// delivery zone rather than trusted from the client, so a customer can't
// tamper with the amount they're asked to pay.
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Please login to continue' }, { status: 401 });

    await connectDB();
    const { subtotal, zoneName } = await request.json();
    const settings = await Settings.findOne().lean();

    if (!settings?.payment?.codDeliveryChargeRequired) {
      return NextResponse.json({ success: false, message: 'Delivery charge prepayment is not required for this store' }, { status: 400 });
    }

    const { charge, zoneName: resolvedZone } = computeDeliveryCharge(subtotal || 0, zoneName, settings);

    if (charge <= 0) {
      return NextResponse.json({ success: false, message: 'No delivery charge applies to this order — you can proceed directly' }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(charge * 100),
      currency: 'bdt',
      metadata: { userId: session.user.id, purpose: 'cod_delivery_charge', zoneName: resolvedZone || '' },
      automatic_payment_methods: { enabled: true },
      description: `Shah International — COD Delivery Charge (${resolvedZone || 'standard zone'})`,
    });

    return NextResponse.json({ success: true, clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, amount: charge });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

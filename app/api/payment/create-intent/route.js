import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { orderId } = await request.json();
    const order = await Order.findById(orderId);
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    if (order.user.toString() !== session.user.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100),
      currency: 'bdt',
      metadata: { orderId: order._id.toString(), userId: session.user.id, orderNumber: order.orderNumber },
      automatic_payment_methods: { enabled: true },
      description: `Shah International – Order #${order.orderNumber}`,
    });
    await Order.findByIdAndUpdate(orderId, { stripePaymentIntentId: paymentIntent.id });
    return NextResponse.json({ success: true, clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

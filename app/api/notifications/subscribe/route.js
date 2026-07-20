import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';

export async function POST(request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    const { subscription } = await request.json();
    if (!subscription?.endpoint) return NextResponse.json({ success: false, message: 'Invalid subscription' }, { status: 400 });
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { endpoint: subscription.endpoint, keys: subscription.keys, user: session?.user?.id, isActive: true, lastUsed: new Date() },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true, message: 'Subscribed to notifications' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await connectDB();
    const { endpoint } = await request.json();
    await PushSubscription.findOneAndUpdate({ endpoint }, { isActive: false });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

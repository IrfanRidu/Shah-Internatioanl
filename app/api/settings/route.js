import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { hasPermission } from '@/lib/permissions';

// Settings change frequently via the admin panel and must be reflected on
// the storefront immediately (phone/WhatsApp/email/address/logo/etc). Force
// this route to always run dynamically and never get cached at any layer.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await connectDB();
    let settings = await Settings.findOne().lean();
    if (!settings) settings = await Settings.create({});
    return NextResponse.json({ success: true, settings }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'Pragma': 'no-cache' },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'settings', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    // IMPORTANT: use $set, not a bare object. Mongo/Mongoose treats a plain object with no operators
    // as a full REPLACEMENT document — any field not present in `body` would be silently wiped from
    // the one-and-only Settings doc. $set only touches the fields actually sent, which is what every
    // caller here actually wants (this route is always called with a partial or full snapshot of the
    // settings form, never intending to erase untouched fields like footer/header links, FAQs, etc).
    const settings = await Settings.findOneAndUpdate({}, { $set: body }, { upsert: true, new: true });
    return NextResponse.json({ success: true, settings }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

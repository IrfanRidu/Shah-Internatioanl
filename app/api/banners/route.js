import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Banner from '@/models/Banner';
import { hasPermission, isAdminRole } from '@/lib/permissions';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    // Batch 18 (R32): `position` narrows to banners meant for a specific page (home/products) —
    // a banner set to 'all' always matches regardless of what's requested, same as before this
    // param existed for callers that don't pass it at all (no position filter applied).
    const position = searchParams.get('position');
    const adminView = searchParams.get('adminView');
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminRole(session);
    const query = adminView && isAdmin ? {} : { isActive: true };
    // Comma-separated type support (e.g. `?type=promotional,side`) — lets a single request cover
    // more than one type at once, since promotional and side banners render through the same
    // shared strip component on the consuming side.
    if (type) query.type = type.includes(',') ? { $in: type.split(',') } : type;
    if (position) query.position = { $in: [position, 'all'] };
    const banners = await Banner.find(query).sort({ displayOrder: 1 }).lean();
    return NextResponse.json({ success: true, banners });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'banners', 'create')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const banner = await Banner.create(body);
    return NextResponse.json({ success: true, banner }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

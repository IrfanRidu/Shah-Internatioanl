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
    const adminView = searchParams.get('adminView');
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminRole(session);
    const query = adminView && isAdmin ? {} : { isActive: true };
    if (type) query.type = type;
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

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportCategory from '@/models/ExportCategory';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// Requirements 2/6/7/8 (Settings config sections) — plain CRUD, no audit-log/recycle-bin wiring:
// these are config/reference data (same tier as Coupons/Categories/FlashSales elsewhere in this
// codebase, none of which are audit-logged either), not one of the three core transactional
// entities (shipment/buyer/country) that lib/exportAudit.js's helpers are built around.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const items = await ExportCategory.find().sort({ displayOrder: 1, name: 1 }).lean();
    return NextResponse.json({ success: true, items });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const body = await request.json();
    const item = await ExportCategory.create(body);
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

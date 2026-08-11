import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportBuyer from '@/models/ExportBuyer';
// Bug fix (pre-existing, found during a systematic sweep of app/api/export/ while fixing the same
// pattern elsewhere for batch 8): this route's .populate('country') needs the model registered.
import ExportCountry from '@/models/ExportCountry';
import { recordAuditLog } from '@/lib/exportAudit';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Exposes buyer contact/address/banking-relevant info — must be admin-only, matching the guard
    // already on POST below (this GET had been missed).
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const { searchParams } = new URL(request.url);
    const query = {};
    if (searchParams.get('country')) query.country = searchParams.get('country');
    const buyers = await ExportBuyer.find(query).populate('country', 'name code flag').sort({ name: 1 }).lean();
    return NextResponse.json({ success: true, buyers });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const body = await request.json();
    const buyer = await ExportBuyer.create(body);
    await recordAuditLog({ session, action: 'create', entityType: 'buyer', entityId: buyer._id, before: null, after: buyer.toObject() });
    return NextResponse.json({ success: true, buyer }, { status: 201 });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

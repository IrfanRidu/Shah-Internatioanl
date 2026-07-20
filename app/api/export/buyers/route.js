import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportBuyer from '@/models/ExportBuyer';
import { recordAuditLog } from '@/lib/exportAudit';

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

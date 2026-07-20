import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportCountry from '@/models/ExportCountry';
import { recordAuditLog } from '@/lib/exportAudit';

export async function GET() {
  try {
    // Low-sensitivity data on its own, but this whole feature area is admin-only (matches the guard
    // already on POST below) and this endpoint has no legitimate public use — guard it too rather
    // than leave one inconsistent open door into the export dashboard's API surface.
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const countries = await ExportCountry.find().sort({ displayOrder: 1, name: 1 }).lean();
    return NextResponse.json({ success: true, countries });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const body = await request.json();
    const country = await ExportCountry.create(body);
    await recordAuditLog({ session, action: 'create', entityType: 'country', entityId: country._id, before: null, after: country.toObject() });
    return NextResponse.json({ success: true, country }, { status: 201 });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportCountry from '@/models/ExportCountry';
import { recordAuditLog, moveToRecycleBin } from '@/lib/exportAudit';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const body = await request.json();
  const before = await ExportCountry.findById(params.id).lean();
  const country = await ExportCountry.findByIdAndUpdate(params.id, body, { new: true });
  await recordAuditLog({ session, action: 'update', entityType: 'country', entityId: params.id, before, after: country?.toObject() });
  return NextResponse.json({ success: true, country });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const doc = await ExportCountry.findById(params.id);
  if (!doc) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  await moveToRecycleBin({ session, entityType: 'country', doc });
  await ExportCountry.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
}

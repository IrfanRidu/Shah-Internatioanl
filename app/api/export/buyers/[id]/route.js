import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportBuyer from '@/models/ExportBuyer';
// Bug fix (pre-existing, found during the same sweep as buyers/route.js).
import ExportCountry from '@/models/ExportCountry';
import { recordAuditLog, moveToRecycleBin } from '@/lib/exportAudit';

const guard = async () => { const s = await getServerSession(authOptions); return ['superAdmin','admin'].includes(s?.user?.role); };
const getSession = () => getServerSession(authOptions);

export async function GET(request, { params }) {
  // Exposes one buyer's full contact/address info — must be admin-only, matching the guard already
  // used on PUT/DELETE below (this GET had been missed).
  if (!await guard()) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const buyer = await ExportBuyer.findById(params.id).populate('country').lean();
  return NextResponse.json({ success: !!buyer, buyer });
}

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const body = await request.json();
  const before = await ExportBuyer.findById(params.id).lean();
  const buyer = await ExportBuyer.findByIdAndUpdate(params.id, body, { new: true });
  await recordAuditLog({ session, action: 'update', entityType: 'buyer', entityId: params.id, before, after: buyer?.toObject() });
  return NextResponse.json({ success: true, buyer });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const doc = await ExportBuyer.findById(params.id);
  if (!doc) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  await moveToRecycleBin({ session, entityType: 'buyer', doc });
  await ExportBuyer.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
}

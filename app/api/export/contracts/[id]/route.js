import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportContract from '@/models/ExportContract';
import ExportBuyer from '@/models/ExportBuyer';
import ExportCountry from '@/models/ExportCountry';
import ExportCategory from '@/models/ExportCategory';
import ExportShipment from '@/models/ExportShipment';
import { recordAuditLog, moveToRecycleBin } from '@/lib/exportAudit';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

const guard = async () => { const s = await getServerSession(authOptions); return ['superAdmin', 'admin'].includes(s?.user?.role); };
const getSession = () => getServerSession(authOptions);

export async function GET(request, { params }) {
  if (!await guard()) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const contract = await ExportContract.findById(params.id)
    .populate('buyer', 'name currency')
    .populate('country', 'name code flag')
    .populate('exportCategory', 'name')
    .lean();
  if (!contract) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  // Shipment count is cheap and saves the contracts list page a second round-trip per card.
  const shipmentCount = await ExportShipment.countDocuments({ exportContract: params.id });
  return NextResponse.json({ success: true, contract: { ...contract, shipmentCount } });
}

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const body = await request.json();
  const before = await ExportContract.findById(params.id).lean();
  if (!before) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  const contract = await ExportContract.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
  await recordAuditLog({ session, action: 'update', entityType: 'exportContract', entityId: params.id, before, after: contract?.toObject() });
  return NextResponse.json({ success: true, contract });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const doc = await ExportContract.findById(params.id);
  if (!doc) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  // No hard block on deleting a contract that still has shipments — matches the existing
  // country/buyer DELETE routes, neither of which blocks on dependent buyers/shipments either.
  // Any shipment left pointing at a deleted contract just shows "Contract not found" wherever it's
  // displayed (handled gracefully, not a crash) until the admin reassigns it — same as an orphaned
  // buyer/country reference already behaves elsewhere in this app today.
  await moveToRecycleBin({ session, entityType: 'exportContract', doc });
  await ExportContract.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
}

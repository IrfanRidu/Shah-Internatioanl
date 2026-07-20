import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import Settings from '@/models/Settings';
import { recordAuditLog, moveToRecycleBin } from '@/lib/exportAudit';
import { calculateShipmentFinancials } from '@/lib/utils';

const guard = async () => { const s = await getServerSession(authOptions); return ['superAdmin','admin'].includes(s?.user?.role); };
const getSession = () => getServerSession(authOptions);

const NON_NEGATIVE_FIELDS = ['totalCTN', 'totalNetWeightKg', 'totalGrossWeightKg', 'freightCost', 'goodsCost', 'exportProcessingCost', 'othersCost', 'totalCost', 'receiveAmountBDT', 'orderValueForeign', 'exchangeRateBDT', 'incentive', 'damage'];
function validateNonNegative(body) {
  for (const f of NON_NEGATIVE_FIELDS) {
    if (body[f] !== undefined && body[f] !== null && body[f] !== '' && Number(body[f]) < 0) return `${f} cannot be negative`;
  }
  return null;
}

// Issue 46: backend is authoritative for the derived financial fields, regardless of what a client
// sends — recomputed fresh against the current persisted Initial Balance every time.
async function withComputedFinancials(body) {
  const settings = await Settings.findOne().lean();
  const initialBalance = settings?.exportAnalyticsInitialBalance || 0;
  const computed = calculateShipmentFinancials({
    initialBalance,
    freightCost: body.freightCost, goodsCost: body.goodsCost, exportProcessingCost: body.exportProcessingCost,
    othersCost: body.othersCost, damage: body.damage, orderValueForeign: body.orderValueForeign,
    exchangeRateBDT: body.exchangeRateBDT, incentive: body.incentive,
  });
  return { ...body, ...computed };
}

export async function GET(request, { params }) {
  // Exposes bank details and buyer/financial data for one shipment — must be admin-only, matching the
  // guard already used on PUT below (this GET had been missed).
  if (!await guard()) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const shipment = await ExportShipment.findById(params.id)
    .populate('buyer', 'name address email phone contactPerson currency')
    .populate('country', 'name code flag')
    .lean();
  return NextResponse.json({ success: !!shipment, shipment });
}

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const body = await request.json();
  const validationError = validateNonNegative(body);
  if (validationError) return NextResponse.json({ success: false, message: validationError }, { status: 400 });
  const before = await ExportShipment.findById(params.id).lean();
  const finalBody = await withComputedFinancials(body);
  const shipment = await ExportShipment.findByIdAndUpdate(params.id, finalBody, { new: true });
  await recordAuditLog({ session, action: 'update', entityType: 'shipment', entityId: params.id, before, after: shipment?.toObject() });
  return NextResponse.json({ success: true, shipment });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  // Issue 45: deletion must be reversible — snapshot the full document into the recycle bin (and log
  // the action) BEFORE removing it, rather than a hard delete with no trace.
  const doc = await ExportShipment.findById(params.id);
  if (!doc) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  await moveToRecycleBin({ session, entityType: 'shipment', doc });
  await ExportShipment.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
}

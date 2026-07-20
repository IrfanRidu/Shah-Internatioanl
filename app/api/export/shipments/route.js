import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import Settings from '@/models/Settings';
import { recordAuditLog } from '@/lib/exportAudit';
import { calculateShipmentFinancials } from '@/lib/utils';

// Issue 46: "calculations should be performed on both frontend (instant UI) and backend (data
// consistency)". The frontend shows a live preview as the admin types, but the values actually
// PERSISTED always come from this server-side recompute — never trusted as-is from the client — so
// they can never drift out of sync with the Initial Balance / formulas even if the client is stale,
// modified, or buggy.
async function withComputedFinancials(body) {
  const settings = await Settings.findOne().lean();
  const initialBalance = settings?.exportAnalyticsInitialBalance || 0;
  const computed = calculateShipmentFinancials({
    initialBalance,
    freightCost: body.freightCost,
    goodsCost: body.goodsCost,
    exportProcessingCost: body.exportProcessingCost,
    othersCost: body.othersCost,
    damage: body.damage,
    orderValueForeign: body.orderValueForeign,
    exchangeRateBDT: body.exchangeRateBDT,
    incentive: body.incentive,
  });
  return { ...body, ...computed };
}

export async function GET(request) {
  try {
    // This lists shipment records containing buyer contact info, bank details, and financial data —
    // must be admin-only, matching the guard already on POST/PUT/DELETE here (this GET had been
    // missed).
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const { searchParams } = new URL(request.url);
    const query = {};
    if (searchParams.get('buyer')) query.buyer = searchParams.get('buyer');
    if (searchParams.get('country')) query.country = searchParams.get('country');
    if (searchParams.get('status')) query.status = searchParams.get('status');
    if (searchParams.get('search')) {
      const re = new RegExp(searchParams.get('search'), 'i');
      query.$or = [{ shipmentNo: re }, { invoiceNo: re }];
    }
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const total = await ExportShipment.countDocuments(query);
    const shipments = await ExportShipment.find(query)
      .populate('buyer', 'name address email phone contactPerson currency')
      .populate('country', 'name code flag')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return NextResponse.json({ success: true, shipments, total, pages: Math.ceil(total / limit) });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

// Issue 46: numeric fields that logically can never be negative — validated server-side so a bad
// value can never enter the DB even if a client-side check is bypassed.
const NON_NEGATIVE_FIELDS = ['totalCTN', 'totalNetWeightKg', 'totalGrossWeightKg', 'freightCost', 'goodsCost', 'exportProcessingCost', 'othersCost', 'totalCost', 'receiveAmountBDT', 'orderValueForeign', 'exchangeRateBDT', 'incentive', 'damage'];
function validateNonNegative(body) {
  for (const f of NON_NEGATIVE_FIELDS) {
    if (body[f] !== undefined && body[f] !== null && body[f] !== '' && Number(body[f]) < 0) {
      return `${f} cannot be negative`;
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const body = await request.json();
    const validationError = validateNonNegative(body);
    if (validationError) return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    const finalBody = await withComputedFinancials(body);
    const shipment = await ExportShipment.create(finalBody);
    await recordAuditLog({ session, action: 'create', entityType: 'shipment', entityId: shipment._id, before: null, after: shipment.toObject() });
    return NextResponse.json({ success: true, shipment }, { status: 201 });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

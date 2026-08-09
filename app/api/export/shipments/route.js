import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import Settings from '@/models/Settings';
// Bug fix: needed so Mongoose actually has every populated model's schema registered — relying on
// some OTHER route having imported them first isn't safe in a serverless deployment, where this
// route can run as its own cold-started function. IncentiveApplication is new to batch 8; the other
// 4 are a pre-existing gap found while already deep in this file.
import IncentiveApplication from '@/models/IncentiveApplication';
import ExportBuyer from '@/models/ExportBuyer';
import ExportCountry from '@/models/ExportCountry';
import ExportCategory from '@/models/ExportCategory';
import ExportLicense from '@/models/ExportLicense';
import ExportContract from '@/models/ExportContract';
import { recordAuditLog } from '@/lib/exportAudit';
import { calculateShipmentFinancials, sanitizeObjectIdFields } from '@/lib/utils';

// ObjectId-reference fields on ExportShipment that an unset <select> can send as '' — see
// sanitizeObjectIdFields's own comment in lib/utils.js for why this matters.
const OBJECT_ID_FIELDS = ['exportLicense', 'exportCategory', 'bankAccount', 'buyer', 'country', 'exportContract'];

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
    ttEntries: body.ttEntries,
  });
  return { ...body, ...computed };
}

// Batch 8 (R2/R3): once a shipment's stored status is anything other than 'draft', it can never be
// pushed back to 'draft' by a later request — logging, once started, never turns off (see the PUT
// handler below for where this matters most; applied here too for defense-in-depth since a client
// could in principle POST a duplicate shipmentNo... no, POST always creates new, so this guard is
// mostly relevant to PUT, but kept as one shared helper so both routes agree on the rule).
function clampStatusRegression(previousStatus, requestedStatus) {
  if (previousStatus && previousStatus !== 'draft' && requestedStatus === 'draft') return previousStatus;
  return requestedStatus;
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
    // Batch 9 (R18): Export Contract page's shipment list. 'none' is the reserved value for the
    // "shipments without a contract" fallback view (pre-batch-9 legacy data) — see the buyer
    // contracts pages.
    const contractParam = searchParams.get('contract');
    if (contractParam === 'none') query.exportContract = null;
    else if (contractParam) query.exportContract = contractParam;
    if (searchParams.get('search')) {
      const re = new RegExp(searchParams.get('search'), 'i');
      query.$or = [{ shipmentNo: re }, { invoiceNo: re }];
    }
    // R10: "Available for Incentive Application" — active shipments not already claimed by any
    // Incentive Application (pending or claimed), that actually have both a contract and a license
    // set (R18's grouping needs both; category is implied by the contract so isn't checked
    // separately here anymore).
    let sort = { date: -1 };
    if (searchParams.get('availableForIncentive') === '1') {
      query.status = 'active';
      query.incentiveApplication = null;
      query.exportContract = { $ne: null };
      query.exportLicense = { $ne: null };
      sort = { date: 1 };
    }
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const total = await ExportShipment.countDocuments(query);
    const shipments = await ExportShipment.find(query)
      .populate('buyer', 'name address email phone contactPerson currency')
      .populate('country', 'name code flag')
      .populate('exportCategory', 'name image')
      .populate('exportLicense', 'letterheadUrl licenseName')
      .populate('exportContract', 'contractNo date value baseCurrency')
      .populate('incentiveApplication', 'status title applicationNumber')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return NextResponse.json({ success: true, shipments, total, pages: Math.ceil(total / limit) });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

// Issue 46: numeric fields that logically can never be negative — validated server-side so a bad
// value can never enter the DB even if a client-side check is bypassed.
const NON_NEGATIVE_FIELDS = ['totalCTN', 'totalNetWeightKg', 'totalGrossWeightKg', 'estimatedGrossWeightKg', 'freightCost', 'goodsCost', 'exportProcessingCost', 'othersCost', 'totalCost', 'receiveAmountBDT', 'orderValueForeign', 'exchangeRateBDT', 'incentive', 'damage'];
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
    const body = sanitizeObjectIdFields(await request.json(), OBJECT_ID_FIELDS);
    const validationError = validateNonNegative(body);
    if (validationError) return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    const finalBody = await withComputedFinancials(body);
    const shipment = await ExportShipment.create(finalBody);
    // R2: a shipment created as a draft is not logged at all — logging only starts once a
    // shipment is active (R3). Most creates go through the editor's "Save Draft" first, so this
    // is the common path; a shipment can also be created directly as active if the admin activates
    // on the very first save.
    if (shipment.status !== 'draft') {
      await recordAuditLog({ session, action: 'create', entityType: 'shipment', entityId: shipment._id, before: null, after: shipment.toObject() });
    }
    return NextResponse.json({ success: true, shipment }, { status: 201 });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import Settings from '@/models/Settings';
import IncentiveApplication from '@/models/IncentiveApplication';
// Bug fix (pre-existing, found while already deep in this file for batch 8): the GET handler below
// populates buyer/country/exportCategory/bankAccount/exportLicense — same missing-model-registration
// risk as the fix + comment in shipments/route.js, just for a gap that predates this batch.
import ExportBuyer from '@/models/ExportBuyer';
import ExportCountry from '@/models/ExportCountry';
import ExportCategory from '@/models/ExportCategory';
import ExportBankAccount from '@/models/ExportBankAccount';
import ExportLicense from '@/models/ExportLicense';
import ExportContract from '@/models/ExportContract';
import { recordAuditLog, moveToRecycleBin } from '@/lib/exportAudit';
import { calculateShipmentFinancials, sanitizeObjectIdFields } from '@/lib/utils';
import { resolveEffectiveRateBDT, isRateOverrideActive, isShipmentLockedByIncentive } from '@/lib/incentiveUtils';
import { recalculateGroupIfPending } from '@/lib/incentiveServer';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

const OBJECT_ID_FIELDS = ['exportLicense', 'exportCategory', 'bankAccount', 'buyer', 'country', 'exportContract'];

const guard = async () => { const s = await getServerSession(authOptions); return ['superAdmin','admin'].includes(s?.user?.role); };
const getSession = () => getServerSession(authOptions);

const NON_NEGATIVE_FIELDS = ['totalCTN', 'totalNetWeightKg', 'totalGrossWeightKg', 'estimatedGrossWeightKg', 'freightCost', 'goodsCost', 'exportProcessingCost', 'othersCost', 'totalCost', 'receiveAmountBDT', 'orderValueForeign', 'exchangeRateBDT', 'incentive', 'damage'];
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
    exchangeRateBDT: body.exchangeRateBDT, incentive: body.incentive, ttEntries: body.ttEntries,
  });
  return { ...body, ...computed };
}

// Batch 8 (R2/R3): logging, once started, never turns off — a PUT can never move a shipment's
// stored status back to 'draft'.
function clampStatusRegression(previousStatus, requestedStatus) {
  if (previousStatus && previousStatus !== 'draft' && requestedStatus === 'draft') return previousStatus;
  return requestedStatus;
}

export async function GET(request, { params }) {
  // Exposes bank details and buyer/financial data for one shipment — must be admin-only, matching the
  // guard already used on PUT below (this GET had been missed).
  if (!await guard()) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const shipment = await ExportShipment.findById(params.id)
    .populate('buyer', 'name address email phone contactPerson currency')
    .populate('country', 'name code flag')
    .populate('exportCategory')
    .populate('bankAccount')
    .populate('exportLicense')
    .populate('exportContract')
    .populate('incentiveApplication')
    .lean();
  return NextResponse.json({ success: !!shipment, shipment });
}

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const body = sanitizeObjectIdFields(await request.json(), OBJECT_ID_FIELDS);
  const validationError = validateNonNegative(body);
  if (validationError) return NextResponse.json({ success: false, message: validationError }, { status: 400 });
  const before = await ExportShipment.findById(params.id).lean();
  if (!before) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

  // R13: a shipment whose Incentive Application has been claimed is unavailable for any kind of
  // change — enforced here server-side (not just a disabled UI), so it can't be bypassed by
  // replaying/crafting a request directly.
  const application = before.incentiveApplication ? await IncentiveApplication.findById(before.incentiveApplication).lean() : null;
  if (isShipmentLockedByIncentive(application)) {
    return NextResponse.json({ success: false, message: `This shipment is locked — it's part of the claimed Incentive Application "${application.title}". Unclaim that application first if changes are really needed.` }, { status: 403 });
  }

  // R11/R18: a still-*pending* Incentive Application isn't locked (its shipments can keep being
  // edited right up until claimed — that's the point of "documentation" being an in-progress
  // state), but Export Contract / Export License / Base Currency specifically define the grouping
  // every member shipment shares (R18's grouping rule, plus R15's single reference currency) —
  // silently changing one out from under a pending application would leave it holding a shipment
  // that no longer actually matches its own contract/license. Export Category is no longer checked
  // directly here — R18 replaced category+license grouping with contract+license, and a contract's
  // category is fixed at contract-creation time anyway. Only these 3 fields are restricted; every
  // other field on the shipment (items, TT entries, costs, notes, documents...) stays fully editable.
  if (application && !isShipmentLockedByIncentive(application)) {
    const changingContract = body.exportContract !== undefined && String(body.exportContract || '') !== String(before.exportContract || '');
    const changingLicense = body.exportLicense !== undefined && String(body.exportLicense || '') !== String(before.exportLicense || '');
    const changingCurrency = body.baseCurrency !== undefined && body.baseCurrency !== before.baseCurrency;
    if (changingContract || changingLicense || changingCurrency) {
      return NextResponse.json({ success: false, message: `Export Contract, Export License, and Base Currency can't be changed while this shipment is part of the Incentive Application "${application.title}" — remove it from that application first (delete the application, or wait for it to be claimed/unclaimed as needed).` }, { status: 409 });
    }
  }

  // R5: the document-text-override editor (Edit button next to Print/Download in the shipment
  // editor) only ever wants to change this one field. This route otherwise does a full-document
  // REPLACE (no $set — see below), which would require the caller to reconstruct and resend the
  // entire shipment just to tweak a declaration paragraph; a GET response has populated reference
  // fields as nested objects though, not the plain ObjectId strings a full replace expects here, so
  // that reconstruction is genuinely risky. This dedicated $set-only branch sidesteps all of that.
  if (body.documentTextOverridesOnly) {
    const updated = await ExportShipment.findByIdAndUpdate(params.id, { $set: { documentTextOverrides: body.documentTextOverrides } }, { new: true });
    return NextResponse.json({ success: true, shipment: updated });
  }

  // R2/R3: draft can't silently be pushed back to draft once left; and R15: while a rate override
  // is active (a manual rate set on this shipment's — still pending — Incentive Application), the
  // effective rate wins over whatever the client sent, the same way "Issue 46" already treats every
  // derived financial field as backend-authoritative.
  body.status = clampStatusRegression(before.status, body.status);
  if (isRateOverrideActive(application)) {
    body.exchangeRateBDT = resolveEffectiveRateBDT(body, application);
  }

  const wasLoggedAlready = before.status !== 'draft';
  const finalBody = await withComputedFinancials(body);
  const shipment = await ExportShipment.findByIdAndUpdate(params.id, finalBody, { new: true });

  // R2/R3: nothing is logged while still draft. The moment a shipment first leaves draft, that
  // save IS the start of its audit trail — recorded as a 'create' entry (nothing logged before it
  // to show as a meaningful "before" state), not an 'update' against an unlogged draft history.
  if (finalBody.status !== 'draft') {
    if (!wasLoggedAlready) {
      await recordAuditLog({ session, action: 'create', entityType: 'shipment', entityId: params.id, before: null, after: shipment?.toObject() });
    } else {
      await recordAuditLog({ session, action: 'update', entityType: 'shipment', entityId: params.id, before, after: shipment?.toObject() });
    }
  }

  // R18/R20: this shipment's own financial data (freight cost, TT entries, order value...) may
  // just have changed, which feeds into its still-pending Incentive Application's group totals
  // (Section D/F of the Ka Form, and the distributed Incentive Application Cost). Re-runs the same
  // cascade the application routes themselves use, for the WHOLE sibling group — keeps every member
  // shipment's Ka Form figures and TT Configuration "Incentive" field in sync with what was just
  // saved here, not only with whatever last touched the application directly. Already a no-op for a
  // claimed application (can't reach this far — isShipmentLockedByIncentive blocks the whole PUT
  // above) or an ungrouped shipment (recalculateGroupIfPending's own early return).
  await recalculateGroupIfPending(shipment, session);

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

  // R13: claimed shipments are unavailable for any kind of change, including deletion. Also — more
  // broadly than R13 literally asks for, but needed to avoid real data corruption — a shipment that
  // belongs to a still-pending (not yet claimed) Incentive Application can't be deleted either,
  // since there's currently no way to individually detach one shipment from a pending application
  // (only deleting the whole application frees its shipments — see the incentive-applications DELETE
  // route); allowing a direct delete here would leave that application with a dangling reference to
  // a shipment that no longer exists.
  const application = doc.incentiveApplication ? await IncentiveApplication.findById(doc.incentiveApplication).lean() : null;
  if (application) {
    const reason = isShipmentLockedByIncentive(application)
      ? `This shipment is locked — it's part of the claimed Incentive Application "${application.title}".`
      : `This shipment is part of the Incentive Application "${application.title}" — delete that application (or wait for it to be claimed/unclaimed as needed) before removing this shipment.`;
    return NextResponse.json({ success: false, message: reason }, { status: 403 });
  }

  // R2: a draft was never logged in the first place, so deleting one leaves no trace either — a
  // plain hard delete, not the recoverable recycle-bin flow used for everything logged (R3).
  if (doc.status === 'draft') {
    await ExportShipment.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  }

  await moveToRecycleBin({ session, entityType: 'shipment', doc });
  await ExportShipment.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import IncentiveApplication from '@/models/IncentiveApplication';
import Settings from '@/models/Settings';
// Bug fix: this route's .populate() calls (including the nested ones inside 'shipments') reference
// ExportBuyer/ExportCountry/ExportCategory/ExportLicense by name — Mongoose needs each one actually
// imported somewhere in this same module graph to have its schema registered, not just referenced
// by string in ExportShipment's own `ref:`. Relying on some OTHER route having already imported them
// first isn't safe (fragile across serverless cold starts, and on a fresh deploy if this route
// happens to be hit before whichever route would otherwise have registered them).
import ExportBuyer from '@/models/ExportBuyer';
import ExportCountry from '@/models/ExportCountry';
import ExportCategory from '@/models/ExportCategory';
import ExportLicense from '@/models/ExportLicense';
import ExportContract from '@/models/ExportContract';
import { canGroupForIncentive, MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION } from '@/lib/incentiveUtils';
import { cascadeRecomputeShipments } from '@/lib/incentiveServer';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

async function guard() {
  const session = await getServerSession(authOptions);
  return ['superAdmin', 'admin'].includes(session?.user?.role);
}

// R9/R12/R13: list every Incentive Application, populated enough for the 3 list tabs (Incentive
// Documentations / Claimed Incentive Applications) to render their cards without a second round
// trip. ?status=documentation|claimed filters; omitted returns everything (used to build both
// tabs' counts client-side in one fetch).
export async function GET(request) {
  try {
    if (!(await guard())) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const { searchParams } = new URL(request.url);
    const query = {};
    if (searchParams.get('status')) query.status = searchParams.get('status');
    const applications = await IncentiveApplication.find(query)
      .populate('exportCategory', 'name image')
      .populate('exportLicense', 'licenseName')
      .populate('exportContract', 'contractNo date value baseCurrency')
      .populate({ path: 'shipments', populate: [{ path: 'buyer', select: 'name' }, { path: 'country', select: 'name flag' }] })
      .sort({ applicationNumber: 1 })
      .lean();
    return NextResponse.json({ success: true, applications });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

// R11/R18: "Proceed for Incentive Documentation" — creates one application from 1-10 shipments the
// admin picked, which must all share the same Export Contract and Export License (re-validated
// here server-side, not just trusted from the client's own checkbox-disabling logic).
export async function POST(request) {
  try {
    if (!(await guard())) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const { shipmentIds } = await request.json();
    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return NextResponse.json({ success: false, message: 'No shipments selected.' }, { status: 400 });
    }
    if (shipmentIds.length > MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION) {
      return NextResponse.json({ success: false, message: `A maximum of ${MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION} shipments can be selected at a time.` }, { status: 400 });
    }
    const shipments = await ExportShipment.find({ _id: { $in: shipmentIds } });
    if (shipments.length !== shipmentIds.length) {
      return NextResponse.json({ success: false, message: 'One or more selected shipments could not be found.' }, { status: 404 });
    }
    // R10: only active, unclaimed-by-anything-else shipments are ever "available" — re-checked here
    // in case of a race (e.g. two admin tabs open at once).
    const alreadyTaken = shipments.find((s) => s.incentiveApplication);
    if (alreadyTaken) {
      return NextResponse.json({ success: false, message: `Shipment ${alreadyTaken.shipmentNo} is already part of another Incentive Application.` }, { status: 409 });
    }
    const notActive = shipments.find((s) => s.status !== 'active');
    if (notActive) {
      return NextResponse.json({ success: false, message: `Shipment ${notActive.shipmentNo} is not active.` }, { status: 409 });
    }
    const grouping = canGroupForIncentive(shipments);
    if (!grouping.ok) return NextResponse.json({ success: false, message: grouping.reason }, { status: 400 });

    // Serial numbering (R12): a persisted, ever-incrementing counter — never reused even across
    // deletions, so two cards can never end up sharing a default name.
    const settings = await Settings.findOneAndUpdate({}, { $inc: { exportIncentiveApplicationCounter: 1 } }, { upsert: true, new: true });
    const applicationNumber = settings.exportIncentiveApplicationCounter;

    const session = await getServerSession(authOptions);
    const application = await IncentiveApplication.create({
      applicationNumber,
      title: `Incentive Application – ${applicationNumber}`,
      exportCategory: shipments[0].exportCategory,
      exportLicense: shipments[0].exportLicense,
      exportContract: shipments[0].exportContract,
      shipments: shipments.map((s) => s._id),
      referenceCurrency: shipments[0].baseCurrency || 'EUR',
    });
    await ExportShipment.updateMany({ _id: { $in: shipmentIds } }, { $set: { incentiveApplication: application._id } });
    // R20: computes+persists the initial equal-share incentive distribution right away, so it's
    // already showing in each member shipment's TT Configuration the moment the application exists
    // — not only after some later edit happens to touch the rate or commission/insurance figure.
    await cascadeRecomputeShipments(shipments, application.toObject(), session);

    return NextResponse.json({ success: true, application }, { status: 201 });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

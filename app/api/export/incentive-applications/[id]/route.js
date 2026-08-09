import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import IncentiveApplication from '@/models/IncentiveApplication';
// Bug fix: see the identical fix + full comment in ../route.js — this route's populates need these
// registered too.
import ExportBuyer from '@/models/ExportBuyer';
import ExportCountry from '@/models/ExportCountry';
import ExportCategory from '@/models/ExportCategory';
import ExportLicense from '@/models/ExportLicense';
import ExportContract from '@/models/ExportContract';
import ExportBankAccount from '@/models/ExportBankAccount';
import { cascadeRecomputeShipments } from '@/lib/incentiveServer';

async function guard() {
  const session = await getServerSession(authOptions);
  return ['superAdmin', 'admin'].includes(session?.user?.role);
}

// R19/R21/R22: the Ka Form + Stamp Application need considerably more than the list page's own
// summary populate — full Export License (name/address/ERC), full Export Contract, the Export
// Category's own incentive/tax/cost rate fields (R20), and each shipment's Bank Account (R22's
// Stamp Application header block) and Export Contract (for display, though every member shares the
// application's own exportContract by construction).
export async function GET(request, { params }) {
  try {
    if (!(await guard())) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const application = await IncentiveApplication.findById(params.id)
      .populate('exportCategory')
      .populate('exportLicense')
      .populate('exportContract')
      .populate({ path: 'shipments', populate: [{ path: 'buyer', select: 'name' }, { path: 'country', select: 'name flag' }, { path: 'exportCategory', select: 'name image' }, { path: 'bankAccount' }] })
      .lean();
    if (!application) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, application });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

// R12 (rename)/R14 (Ka Form, Others)/R15 (manual rate). R13: "From this tab Claimed applications
// only can be unclaimed and viewed" — once claimed, this route is closed entirely; only the
// dedicated claim/unclaim endpoints can touch a claimed application.
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  try {
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const body = await request.json();
    const before = await IncentiveApplication.findById(params.id);
    if (!before) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    if (before.status === 'claimed') {
      return NextResponse.json({ success: false, message: 'This application is claimed — unclaim it first to make changes.' }, { status: 403 });
    }

    const update = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.kaForm !== undefined) update.kaForm = body.kaForm;
    if (body.others !== undefined) update.others = body.others;
    // R15: an explicit empty string/null clears the manual rate (falls back to each shipment's own
    // rate again); any other value sets/replaces it. undefined means "not part of this request".
    const manualRateChanging = body.manualRateBDT !== undefined;
    if (manualRateChanging) {
      update.manualRateBDT = (body.manualRateBDT === '' || body.manualRateBDT === null) ? null : Number(body.manualRateBDT);
    }

    const application = await IncentiveApplication.findByIdAndUpdate(params.id, { $set: update }, { new: true });

    // R15/R20: manualRateBDT and kaForm (specifically commissionInsuranceValue inside it) both feed
    // directly into calculateIncentiveCosting — either one changing means every member shipment's
    // derived financials AND its distributed incentive share need recomputing. Recomputing on any
    // kaForm update (not just when commissionInsuranceValue specifically changed) is a deliberate
    // simplification — these are infrequent admin edits, not a hot path, so the extra safety of
    // "always correct after any kaForm save" outweighs the cost of an occasionally-unnecessary
    // recompute when only e.g. supplierNameAddress changed.
    if (manualRateChanging || body.kaForm !== undefined) {
      const shipments = await ExportShipment.find({ _id: { $in: application.shipments } }).lean();
      await cascadeRecomputeShipments(shipments, application.toObject(), session);
    }

    return NextResponse.json({ success: true, application });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

// R12: Delete is only offered from the Incentive Documentations tab (pending, not yet claimed) —
// frees every member shipment back to "Available for Incentive Application".
export async function DELETE(request, { params }) {
  try {
    if (!(await guard())) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const application = await IncentiveApplication.findById(params.id);
    if (!application) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    if (application.status === 'claimed') {
      return NextResponse.json({ success: false, message: 'A claimed application cannot be deleted — unclaim it first.' }, { status: 403 });
    }
    await ExportShipment.updateMany({ _id: { $in: application.shipments } }, { $set: { incentiveApplication: null } });
    await IncentiveApplication.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

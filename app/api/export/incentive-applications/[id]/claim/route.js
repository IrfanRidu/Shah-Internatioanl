import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import IncentiveApplication from '@/models/IncentiveApplication';
import CurrencyRate from '@/models/CurrencyRate';
// Bug fix: see the identical fix + full comment in ../../route.js — this route's final populated
// response needs these registered too.
import ExportBuyer from '@/models/ExportBuyer';
import ExportCountry from '@/models/ExportCountry';
import ExportCategory from '@/models/ExportCategory';
import ExportLicense from '@/models/ExportLicense';
import { fetchLiveRates, STATIC_FALLBACK } from '@/lib/exchangeRates';
import { cascadeRecomputeShipments } from '@/lib/incentiveServer';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// R13: "Mark as Incentive Claimed" — moves the application to the Claimed tab, and every member
// shipment becomes fully locked (no edits of any kind) with its BDT rate frozen at whatever was
// live/manual at this exact moment, marked completed, and (since Export Archive already just
// filters status:'completed' — nothing else needed there) surfaces automatically in the archive.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  try {
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const application = await IncentiveApplication.findById(params.id);
    if (!application) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    if (application.status === 'claimed') return NextResponse.json({ success: false, message: 'Already claimed.' }, { status: 409 });

    // R15: only need to freeze a live rate if the admin never set a manual one — a manual rate is
    // already a fixed number and simply continues to apply after claiming, same as before it.
    if (!application.manualRateBDT) {
      let rateDoc = await CurrencyRate.findOne().sort('-lastUpdated');
      const isStale = !rateDoc || (Date.now() - new Date(rateDoc.lastUpdated).getTime() > 30 * 60 * 1000);
      if (isStale) {
        const live = await fetchLiveRates();
        if (live) rateDoc = await CurrencyRate.findOneAndUpdate({}, { rates: live.rates, lastUpdated: new Date(), base: 'USD', source: live.source }, { upsert: true, new: true });
      }
      const rates = rateDoc?.rates || STATIC_FALLBACK;
      const currency = application.referenceCurrency || 'EUR';
      const bdtPerUnit = rates.BDT && rates[currency] ? rates.BDT / rates[currency] : null;
      if (bdtPerUnit) application.lockedRateBDT = bdtPerUnit;
    }
    application.status = 'claimed';
    application.claimedAt = new Date();
    await application.save();

    // R13: completed (auto-surfaces in Export Archive) + rate recompute, combined into one update
    // and one audit log entry per shipment — resolver picks manualRateBDT, else the just-captured
    // lockedRateBDT, now that application.status is 'claimed'.
    const shipments = await ExportShipment.find({ _id: { $in: application.shipments } });
    await cascadeRecomputeShipments(shipments, application, session, 'completed');

    const populated = await IncentiveApplication.findById(params.id)
      .populate('exportCategory', 'name image').populate('exportLicense', 'licenseName')
      .populate({ path: 'shipments', populate: [{ path: 'buyer', select: 'name' }, { path: 'country', select: 'name flag' }] });
    return NextResponse.json({ success: true, application: populated });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

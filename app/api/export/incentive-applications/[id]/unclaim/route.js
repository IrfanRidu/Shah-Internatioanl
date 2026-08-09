import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import IncentiveApplication from '@/models/IncentiveApplication';
// Bug fix: see the identical fix + full comment in ../../route.js — this route's final populated
// response needs these registered too.
import ExportBuyer from '@/models/ExportBuyer';
import ExportCountry from '@/models/ExportCountry';
import ExportCategory from '@/models/ExportCategory';
import ExportLicense from '@/models/ExportLicense';
import { cascadeRecomputeShipments } from '@/lib/incentiveServer';

// R13: "From this tab Claimed applications only can be unclaimed and viewed" — the only mutation
// available on a claimed application. Reverses claim(): member shipments go back to 'active' (so
// they leave Export Archive and become editable again), and the frozen live rate is cleared — if no
// manual rate is set, each shipment's own rate simply resumes tracking live again; if a manual rate
// IS set, it keeps applying (R15's override isn't tied to claim status, only to its own presence).
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  try {
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const application = await IncentiveApplication.findById(params.id);
    if (!application) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    if (application.status !== 'claimed') return NextResponse.json({ success: false, message: 'This application is not currently claimed.' }, { status: 409 });

    application.status = 'documentation';
    application.unclaimedAt = new Date();
    application.lockedRateBDT = null;
    await application.save();

    const shipments = await ExportShipment.find({ _id: { $in: application.shipments } });
    await cascadeRecomputeShipments(shipments, application, session, 'active');

    const populated = await IncentiveApplication.findById(params.id)
      .populate('exportCategory', 'name image').populate('exportLicense', 'licenseName')
      .populate({ path: 'shipments', populate: [{ path: 'buyer', select: 'name' }, { path: 'country', select: 'name flag' }] });
    return NextResponse.json({ success: true, application: populated });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

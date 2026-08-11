import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportContract from '@/models/ExportContract';
// Needed for the .populate() calls below to work — Mongoose must have every referenced model
// registered, not just the one being queried (same pre-existing gotcha noted in buyers/route.js).
import ExportBuyer from '@/models/ExportBuyer';
import ExportCountry from '@/models/ExportCountry';
import ExportCategory from '@/models/ExportCategory';
import { recordAuditLog } from '@/lib/exportAudit';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

const guard = async () => { const s = await getServerSession(authOptions); return ['superAdmin', 'admin'].includes(s?.user?.role); };

export async function GET(request) {
  try {
    if (!await guard()) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const { searchParams } = new URL(request.url);
    const query = {};
    if (searchParams.get('buyer')) query.buyer = searchParams.get('buyer');
    if (searchParams.get('country')) query.country = searchParams.get('country');
    const contracts = await ExportContract.find(query)
      .populate('buyer', 'name')
      .populate('country', 'name code flag')
      .populate('exportCategory', 'name')
      .sort({ date: -1 })
      .lean();
    return NextResponse.json({ success: true, contracts });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const body = await request.json();
    if (!body.buyer || !body.country || !body.contractNo || !body.date) {
      return NextResponse.json({ success: false, message: 'Buyer, Country, Contract No and Date are required' }, { status: 400 });
    }
    const contract = await ExportContract.create(body);
    await recordAuditLog({ session, action: 'create', entityType: 'exportContract', entityId: contract._id, before: null, after: contract.toObject() });
    return NextResponse.json({ success: true, contract }, { status: 201 });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

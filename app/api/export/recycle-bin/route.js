import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportRecycleBin from '@/models/ExportRecycleBin';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const query = { restored: false };
    if (entityType) query.entityType = entityType;
    const items = await ExportRecycleBin.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, items });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

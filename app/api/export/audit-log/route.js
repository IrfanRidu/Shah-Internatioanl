import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportAuditLog from '@/models/ExportAuditLog';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const query = {};
    if (entityType) query.entityType = entityType;
    const total = await ExportAuditLog.countDocuments(query);
    const logs = await ExportAuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return NextResponse.json({ success: true, logs, total, pages: Math.ceil(total / limit) });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

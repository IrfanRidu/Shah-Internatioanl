import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportLicense from '@/models/ExportLicense';

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const body = await request.json();
  const item = await ExportLicense.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
  if (!item) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, item });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();
  const item = await ExportLicense.findByIdAndDelete(params.id);
  if (!item) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}

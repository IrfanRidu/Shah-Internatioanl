import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Banner from '@/models/Banner';
import { hasPermission, isAdminRole } from '@/lib/permissions';

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'banners', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const banner = await Banner.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ success: true, banner });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'banners', 'delete')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    await Banner.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

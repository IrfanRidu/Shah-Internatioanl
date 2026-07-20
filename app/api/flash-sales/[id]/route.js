import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import FlashSale from '@/models/FlashSale';
import { hasPermission, isAdminRole } from '@/lib/permissions';

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'flashSales', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const sale = await FlashSale.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ success: true, sale });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'flashSales', 'delete')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    await FlashSale.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

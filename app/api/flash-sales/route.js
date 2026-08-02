import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import FlashSale from '@/models/FlashSale';
import { hasPermission, isAdminRole } from '@/lib/permissions';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminRole(session);
    const query = !isAdmin || activeOnly ? { isActive: true, startTime: { $lte: new Date() }, endTime: { $gte: new Date() } } : {};
    const sales = await FlashSale.find(query).populate('items.product', 'name images slug availableForLocal availableForInternational').sort('-createdAt').lean();
    return NextResponse.json({ success: true, sales });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'flashSales', 'create')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const sale = await FlashSale.create(body);
    return NextResponse.json({ success: true, sale }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

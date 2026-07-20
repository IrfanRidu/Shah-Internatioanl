import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import { hasPermission } from '@/lib/permissions';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'inventory', 'view')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { searchParams } = new URL(request.url);
    const lowStock = searchParams.get('lowStock') === 'true';
    const query = lowStock ? { $expr: { $lte: ['$currentStock', '$minimumStockAlert'] } } : {};
    const inventory = await Inventory.find(query).populate('product', 'name slug images unit').sort('-updatedAt').lean();
    return NextResponse.json({ success: true, inventory });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

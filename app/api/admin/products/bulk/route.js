import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Inventory from '@/models/Inventory';
import { hasPermission } from '@/lib/permissions';

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'products', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { ids, action, value } = await request.json();
    if (!ids?.length) return NextResponse.json({ success: false, message: 'No products selected' }, { status: 400 });

    let updateObj = {};
    switch (action) {
      case 'activate':   updateObj = { isActive: true }; break;
      case 'deactivate': updateObj = { isActive: false }; break;
      case 'feature':    updateObj = { isFeatured: true }; break;
      case 'unfeature':  updateObj = { isFeatured: false }; break;
      case 'organic':    updateObj = { isOrganic: true }; break;
      case 'category':   updateObj = { category: value }; break;
      default: return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
    }

    const result = await Product.updateMany({ _id: { $in: ids } }, updateObj);
    return NextResponse.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'products', 'delete')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { ids } = await request.json();
    if (!ids?.length) return NextResponse.json({ success: false, message: 'No products selected' }, { status: 400 });
    await Product.updateMany({ _id: { $in: ids } }, { isActive: false });
    return NextResponse.json({ success: true, deactivated: ids.length });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

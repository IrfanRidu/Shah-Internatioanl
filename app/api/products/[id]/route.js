import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Inventory from '@/models/Inventory';
import { hasPermission, isAdminRole } from '@/lib/permissions';
import { computeHarvestingSeason } from '@/lib/utils';
import { applyComputedHarvestSeason } from '@/lib/harvestSeason';

export async function GET(request, { params }) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminRole(session);

    // MongoDB ObjectId is a 24-char hex string — not a number.
    // isNaN('507f1f77bcf86cd799439011') returns false (hex chars confuse it),
    // so we check via a proper ObjectId regex instead.
    const isObjectId = /^[a-f\d]{24}$/i.test(params.id);
    const query = isObjectId ? { _id: params.id } : { slug: params.id };
    const product = await Product.findOne(query).populate('category', 'name slug subcategories').lean();

    if (!product) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    if (!product.isActive && !isAdmin) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    applyComputedHarvestSeason(product);

    if (!isAdmin) { const { productCost, ...rest } = product; return NextResponse.json({ success: true, product: rest }); }

    const inventory = await Inventory.findOne({ product: product._id }).lean();
    return NextResponse.json({ success: true, product, inventory });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'products', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    // Issue 4: same server-side authority as POST — but only recompute when this update actually
    // includes harvestingMonths, so a partial update that doesn't touch it at all (e.g. a quick
    // stock-quantity edit) can't accidentally stomp isHarvestingSeason using an absent/undefined array.
    if (body.harvestingMonths !== undefined) {
      const computedSeason = computeHarvestingSeason(body.harvestingMonths);
      if (computedSeason !== null) body.isHarvestingSeason = computedSeason;
    }
    const product = await Product.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
    if (!product) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });

    // Update inventory if quantity changed
    if (body.quantity !== undefined) {
      await Inventory.findOneAndUpdate({ product: params.id }, { currentStock: body.quantity }, { upsert: true });
    }
    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'products', 'delete')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    await Product.findByIdAndUpdate(params.id, { isActive: false });
    return NextResponse.json({ success: true, message: 'Product deactivated' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

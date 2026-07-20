import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Inventory from '@/models/Inventory';
import { generateSlug, buildProductQuery, paginateQuery } from '@/lib/utils';
import { hasPermission, isAdminRole } from '@/lib/permissions';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 20;
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const buyerType = searchParams.get('buyerType');
    const search = searchParams.get('search');
    const isFeatured = searchParams.get('featured');
    const isHarvesting = searchParams.get('harvesting');
    const sort = searchParams.get('sort') || '-createdAt';
    const adminView = searchParams.get('adminView');

    const session = await getServerSession(authOptions);
    const isAdmin = isAdminRole(session);

    const query = adminView && isAdmin ? {} : buildProductQuery({ category, subcategory, buyerType, search, isFeatured, isHarvesting });
    const { skip, limit: lim } = paginateQuery(page, limit);

    // Seasonal products first, then by requested sort
    const sortOptions = sort === '-createdAt'
      ? { isHarvestingSeason: -1, isFeatured: -1, createdAt: -1 }
      : sort.startsWith('-') ? { isHarvestingSeason: -1, [sort.slice(1)]: -1 } : { isHarvestingSeason: -1, [sort]: 1 };

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(lim)
      .lean();

    // Hide productCost from non-admins
    const sanitized = products.map(p => {
      if (!isAdmin) { const { productCost, ...rest } = p; return rest; }
      return p;
    });

    const total = await Product.countDocuments(query);
    return NextResponse.json({ success: true, products: sanitized, total, page: parseInt(page), pages: Math.ceil(total / lim) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'products', 'create')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    body.slug = generateSlug(body.name);

    // Check slug uniqueness
    const existing = await Product.findOne({ slug: body.slug });
    if (existing) body.slug = `${body.slug}-${Date.now()}`;

    const product = await Product.create(body);

    // Create inventory record
    await Inventory.create({ product: product._id, currentStock: body.quantity || 0, availableStock: body.quantity || 0 });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

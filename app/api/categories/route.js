import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import { generateSlug } from '@/lib/utils';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  try {
    await connectDB();
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 }).lean();
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'categories', 'create')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    body.slug = generateSlug(body.name);
    if (body.subcategories) {
      body.subcategories = body.subcategories.map(s => ({ ...s, slug: generateSlug(s.name) }));
    }
    const category = await Category.create(body);
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

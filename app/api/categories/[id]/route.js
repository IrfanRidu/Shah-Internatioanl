import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import { generateSlug } from '@/lib/utils';
import { hasPermission } from '@/lib/permissions';

export async function GET(request, { params }) {
  try {
    await connectDB();
    const category = await Category.findOne({ $or: [{ _id: params.id }, { slug: params.id }] });
    if (!category) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, category });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'categories', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    if (body.subcategories) {
      body.subcategories = body.subcategories.map(s => ({ ...s, slug: s.slug || generateSlug(s.name) }));
    }
    const category = await Category.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ success: true, category });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'categories', 'delete')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    await Category.findByIdAndUpdate(params.id, { isActive: false });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

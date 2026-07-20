import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Page from '@/models/Page';
import { hasPermission } from '@/lib/permissions';

export async function GET(request, { params }) {
  try {
    await connectDB();
    const page = await Page.findOne({ $or: [{ _id: params.id }, { slug: params.id }], isActive: true }).lean();
    if (!page) return NextResponse.json({ success: false, message: 'Page not found' }, { status: 404 });
    return NextResponse.json({ success: true, page });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'pages', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const page = await Page.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ success: true, page });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'pages', 'delete')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    await Page.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

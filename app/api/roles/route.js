import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Role from '@/models/Role';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'superAdmin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();
    const roles = await Role.find().populate('createdBy', 'name').lean();
    return NextResponse.json({ success: true, roles });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'superAdmin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();
    const body = await request.json();
    body.createdBy = session.user.id;
    const role = await Role.create(body);
    return NextResponse.json({ success: true, role }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

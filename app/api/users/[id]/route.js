import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const isAdmin = ['superAdmin', 'admin', 'editor'].includes(session.user.role);
    if (!isAdmin && session.user.id !== params.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const user = await User.findById(params.id).lean();
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const isAdmin = ['superAdmin', 'admin'].includes(session.user.role);
    const isSuperAdmin = session.user.role === 'superAdmin';
    if (!isAdmin && session.user.id !== params.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    // Only the Super Admin may grant/change a staff member's role or assigned permission Role.
    // This is what enforces "others can't access any data except what's been granted to them."
    if (!isSuperAdmin) { delete body.role; delete body.adminRoleId; }
    const user = await User.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'superAdmin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();
    await User.findByIdAndUpdate(params.id, { isActive: false });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

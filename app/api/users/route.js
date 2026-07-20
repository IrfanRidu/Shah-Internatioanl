import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendWelcomeEmail } from '@/lib/email';
import { hasPermission, isAdminRole } from '@/lib/permissions';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role') || '';
    const isCustomerQuery = roleFilter.includes('localBuyer') || roleFilter.includes('internationalBuyer');

    // superAdmin and admin always have full access.
    // Editor role needs the explicit customers.view permission.
    // hasPermission() already handles this correctly (returns true for admin/superAdmin).
    const authorized = isCustomerQuery
      ? hasPermission(session, 'customers', 'view')
      : isAdminRole(session);

    if (!authorized) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const role = searchParams.get('role');
    const buyerType = searchParams.get('buyerType');
    const search = searchParams.get('search');
    const sortField = searchParams.get('sort') || 'createdAt';
    const sortDir = searchParams.get('dir') === 'asc' ? 1 : -1;

    const query = {};
    if (role) {
      // Handle comma-separated roles e.g. "localBuyer,internationalBuyer"
      const roles = role.split(',').map(r => r.trim()).filter(Boolean);
      query.role = roles.length === 1 ? roles[0] : { $in: roles };
    }
    if (buyerType) query.buyerType = buyerType;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, email, password, phone, buyerType, country, company } = body;

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return NextResponse.json({ success: false, message: 'Email already registered' }, { status: 400 });

    const role = buyerType === 'international' ? 'internationalBuyer' : 'localBuyer';
    const user = await User.create({ name, email, password, phone, buyerType: buyerType || 'local', role, country, company });

    try { await sendWelcomeEmail(user); } catch (e) { console.error('Welcome email failed:', e); }

    return NextResponse.json({ success: true, message: 'Account created successfully' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

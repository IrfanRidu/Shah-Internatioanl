import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import SpecialSection from '@/models/SpecialSection';
import { hasPermission, isAdminRole } from '@/lib/permissions';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const adminView = searchParams.get('adminView');
    const position = searchParams.get('position');
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminRole(session);
    const query = adminView && isAdmin ? {} : { isActive: true };
    if (position) query.position = { $in: [position, 'both'] };
    const sections = await SpecialSection.find(query).populate('products', 'name images slug price discountPrice priceRangeMin priceRangeMax isHarvestingSeason unit').sort('displayOrder').lean();
    return NextResponse.json({ success: true, sections });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'sections', 'create')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const section = await SpecialSection.create(body);
    return NextResponse.json({ success: true, section }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

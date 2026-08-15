import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import SpecialSection from '@/models/SpecialSection';
// Batch 17 (R9): required by .populate('products', ...) below — see the fuller comment in
// app/(shop)/products/[slug]/page.jsx for why this direct import is necessary.
import Product from '@/models/Product';
import { hasPermission, isAdminRole } from '@/lib/permissions';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

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
    const sections = await SpecialSection.find(query).populate('products', 'name images slug price discountPrice priceRangeMin priceRangeMax isHarvestingSeason unit availableForLocal availableForInternational').sort('displayOrder').lean();
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

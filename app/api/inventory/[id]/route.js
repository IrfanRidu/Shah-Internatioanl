import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import { hasPermission } from '@/lib/permissions';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'inventory', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { quantity, type, reason } = await request.json();
    const inv = await Inventory.findById(params.id);
    if (!inv) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    if (type === 'in') inv.currentStock += quantity;
    else if (type === 'out') inv.currentStock = Math.max(0, inv.currentStock - quantity);
    else inv.currentStock = quantity;
    inv.availableStock = inv.currentStock - inv.reservedStock;
    inv.transactions.push({ type, quantity, reason, performedBy: session.user.id });
    if (type === 'in') { inv.lastRestocked = new Date(); inv.lastRestockedQuantity = quantity; }
    await inv.save();
    return NextResponse.json({ success: true, inventory: inv });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

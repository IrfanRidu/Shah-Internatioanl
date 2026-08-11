import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { buyerType } = await request.json();

    // CRITICAL: only ever update `buyerType` here — NEVER `role`.
    //
    // `buyerType` (local/international) is just a pricing/UI preference that
    // any logged-in user can freely switch at any time via the header toggle
    // — including admin, superAdmin, and editor accounts (the toggle isn't
    // hidden from staff). `role` is the account's actual permission level.
    //
    // The previous version of this route recomputed `role` from `buyerType`
    // on every switch (`role = buyerType === 'international' ? ... `) and
    // wrote it to the database unconditionally. That meant an admin merely
    // clicking "Switch to Local" while browsing their own storefront would
    // silently overwrite their `role` in the DB from 'admin'/'superAdmin' to
    // 'localBuyer' — invisible immediately (their current session JWT still
    // had the old role cached), but surfacing the next time they signed in,
    // since `authorize()` reads `role` fresh from the DB on every login. This
    // is what caused "role resets to buyer type after logging out".
    //
    // A buyer account's `role` (localBuyer vs internationalBuyer) is set
    // once at registration (see /api/users route) and should stay that way;
    // nothing in the app actually branches on which of the two buyer roles
    // an account has — all buyer-type-specific UI/pricing logic reads
    // `buyerType`, not `role`. There is therefore no correct reason for this
    // preference-switch endpoint to ever touch `role`.
    await User.findByIdAndUpdate(session.user.id, { buyerType });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

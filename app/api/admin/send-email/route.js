import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail } from '@/lib/email';
import { hasPermission } from '@/lib/permissions';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'marketing', 'send')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { subject, body, audience, userIds } = await request.json();
    if (!subject || !body) return NextResponse.json({ success: false, message: 'Subject and body required' }, { status: 400 });

    let users;
    if (userIds?.length) {
      users = await User.find({ _id: { $in: userIds }, isActive: true }).select('name email').lean();
    } else {
      const query = { isActive: true };
      if (audience === 'local') query.buyerType = 'local';
      else if (audience === 'international') query.buyerType = 'international';
      else query.role = { $in: ['localBuyer', 'internationalBuyer'] };
      users = await User.find(query).select('name email').lean();
    }

    let sent = 0, failed = 0;
    const BATCH_SIZE = 10;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (u) => {
        try {
          // Batch 19 (R33-9): was `.replace('{{name}}', u.name)` — a STRING argument to .replace()
          // only replaces the FIRST occurrence, so any template mentioning {{name}} more than once
          // (a closing "Thanks, {{name}}!" as well as the opening greeting, for example) left every
          // occurrence after the first as literal, unreplaced placeholder text. A global regex
          // replaces every occurrence, matching what the admin UI's own hint text promises.
          await sendEmail({ to: u.email, subject, html: body.replace(/\{\{name\}\}/g, u.name) });
          sent++;
        } catch { failed++; }
      }));
      await new Promise(r => setTimeout(r, 300));
    }

    return NextResponse.json({ success: true, sent, failed, total: users.length });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

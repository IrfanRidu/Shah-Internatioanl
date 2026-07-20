import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail } from '@/lib/email';
import { hasPermission } from '@/lib/permissions';

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
          await sendEmail({ to: u.email, subject, html: body.replace('{{name}}', u.name) });
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

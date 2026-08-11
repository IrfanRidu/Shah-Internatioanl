import { NextResponse } from 'next/server';
import { sendQuotationEmail } from '@/lib/email';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, company, country, product, quantity, message } = body;
    if (!name || !email || !product || !quantity) {
      return NextResponse.json({ success: false, message: 'Please fill all required fields' }, { status: 400 });
    }
    await sendQuotationEmail({ to: email, name, company, product, quantity, message });
    return NextResponse.json({ success: true, message: 'Quotation request sent successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

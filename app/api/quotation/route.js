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
    // Batch 19 (R33-6): log the real error server-side (Vercel Function Logs) for diagnosis, but
    // never pass raw SMTP internals through to the customer-facing response — a "535 Username and
    // Password not accepted" Gmail auth error is both confusing to a customer and a minor
    // information disclosure about backend implementation. This is very likely an environment/
    // credentials issue on Gmail's side (a regular account password where Gmail now requires a
    // 16-character App Password for SMTP, once 2-Step Verification is on — which is effectively
    // required by Google now), not something fixable in this code; see PROJECT_STATUS.md for the
    // full note on what needs checking in Vercel's environment variables / the Google Account.
    console.error('Quotation email failed:', error);
    return NextResponse.json({ success: false, message: 'Sorry, we could not send your quotation request right now. Please reach us directly via WhatsApp or email in the meantime.' }, { status: 500 });
  }
}

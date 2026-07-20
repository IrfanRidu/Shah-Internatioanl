import { NextResponse } from 'next/server';
import { sendQuotationEmail } from '@/lib/email';

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

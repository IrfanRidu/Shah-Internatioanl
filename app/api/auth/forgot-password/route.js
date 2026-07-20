import { NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendPasswordReset } from '@/lib/email';

export async function POST(request) {
  try {
    await connectDB();
    const { email } = await request.json();
    if (!email) return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    const user = await User.findOne({ email: email.toLowerCase() });
    // Always return success to prevent email enumeration
    if (!user) return NextResponse.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await User.findByIdAndUpdate(user._id, { resetPasswordToken: token, resetPasswordExpires: expires });
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    await sendPasswordReset(user, resetUrl);
    return NextResponse.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

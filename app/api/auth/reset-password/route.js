import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request) {
  try {
    await connectDB();
    const { token, email, password } = await request.json();
    if (!token || !email || !password) {
      return NextResponse.json({ success: false, message: 'All fields are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ success: false, message: 'Password must be at least 8 characters' }, { status: 400 });
    }
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 });
    }
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    return NextResponse.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

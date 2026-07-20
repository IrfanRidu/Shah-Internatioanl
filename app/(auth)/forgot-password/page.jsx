'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Mail, Leaf, ArrowLeft, CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email'); return; }
    setLoading(true);
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) setSent(true);
    else toast.error(data.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-xl">Shah International</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Check Your Email</h1>
              <p className="text-gray-500 text-sm mb-6">
                We've sent a password reset link to <strong>{email}</strong>. Check your inbox and spam folder.
              </p>
              <p className="text-xs text-gray-400 mb-6">The link expires in 1 hour.</p>
              <Link href="/login">
                <Button variant="primary" className="w-full">Back to Login</Button>
              </Link>
            </div>
          ) : (
            <>
              <Link href="/login" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset Password</h1>
              <p className="text-gray-500 text-sm mb-6">Enter your email and we'll send you a reset link</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Email Address" type="email" required icon={Mail} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                <Button type="submit" variant="primary" className="w-full" size="lg" loading={loading}>Send Reset Link</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

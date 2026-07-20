'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Leaf, Eye, EyeOff, CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const email = params.get('email');
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPass, setShowPass] = useState(false);

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl p-8 shadow-xl max-w-md w-full">
          <p className="text-red-500 font-semibold mb-4">❌ Invalid reset link</p>
          <Link href="/forgot-password"><Button variant="primary">Request New Link</Button></Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email, password: form.password }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) { setDone(true); setTimeout(() => router.push('/login'), 3000); }
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
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Password Reset!</h1>
              <p className="text-gray-500 text-sm mb-6">Your password has been changed. Redirecting to login...</p>
              <Link href="/login"><Button variant="primary" className="w-full">Go to Login</Button></Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Set New Password</h1>
              <p className="text-gray-500 text-sm mb-6">for <strong>{email}</strong></p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input label="New Password" type={showPass ? 'text' : 'password'} required icon={Lock} placeholder="Min. 8 characters" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                    {showPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                <Input label="Confirm Password" type="password" required icon={Lock} placeholder="Repeat password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} />
                <div className="space-y-1">
                  {[{ ok: form.password.length >= 8, label: 'At least 8 characters' }, { ok: /[A-Z]/.test(form.password), label: 'One uppercase letter' }, { ok: /[0-9]/.test(form.password), label: 'One number' }].map(({ ok, label }) => (
                    <div key={label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {label}
                    </div>
                  ))}
                </div>
                <Button type="submit" variant="primary" className="w-full" size="lg" loading={loading}>Reset Password</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

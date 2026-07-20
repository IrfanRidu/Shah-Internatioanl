'use client';
import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Leaf, Eye, EyeOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please enter email and password'); return; }
    setLoading(true);
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) toast.error('Invalid email or password');
    else { toast.success('Welcome back!'); router.push(callbackUrl); router.refresh(); }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn('google', { callbackUrl });
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-center p-12 w-1/2 gradient-brand text-white">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><Leaf className="w-7 h-7" /></div>
          <div><div className="text-xl font-bold">Shah International</div><div className="text-green-200 text-sm">Farm Fresh. Global Reach.</div></div>
        </div>
        <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Welcome Back!</h2>
        <p className="text-green-100 text-lg leading-relaxed mb-8">Login to manage your orders, track deliveries, and explore our freshest seasonal produce from Bangladesh's finest farms.</p>
        <div className="grid grid-cols-2 gap-4">
          {[{ v: '35+', l: 'Countries' }, { v: '120+', l: 'Products' }, { v: '15+', l: 'Years' }, { v: '5000+', l: 'Customers' }].map(({ v, l }) => (
            <div key={l} className="bg-white/10 rounded-xl p-4 text-center"><div className="text-2xl font-bold">{v}</div><div className="text-green-200 text-sm">{l}</div></div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Leaf className="w-6 h-6 text-brand" /><span className="font-bold text-gray-900">Shah International</span>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign In</h1>
            <p className="text-gray-500 text-sm mb-6">Enter your credentials to continue</p>

            {/* Google sign-in */}
            <button onClick={handleGoogle} disabled={googleLoading} className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all mb-4 disabled:opacity-50">
              {googleLoading ? <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              )}
              <span className="text-sm font-semibold text-gray-700">Continue with Google</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or sign in with email</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Email Address" type="email" required icon={Mail} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              <div>
                <Input label="Password" type={showPass ? 'text' : 'password'} required icon={Lock} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                <div className="flex justify-between mt-1">
                  <button type="button" onClick={() => setShowPass(!showPass)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    {showPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {showPass ? 'Hide' : 'Show'}
                  </button>
                  <Link href="/forgot-password" className="text-xs text-brand hover:underline">Forgot password?</Link>
                </div>
              </div>
              <Button type="submit" variant="primary" className="w-full" loading={loading} size="lg">Sign In</Button>
            </form>

            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 mb-1">Demo Credentials:</p>
              <p className="text-xs text-amber-600">Super Admin: admin@shahintl.com / SuperAdmin123!</p>
              <p className="text-xs text-amber-600">Local Buyer: rahul.bd@test.com / Test123!</p>
              <p className="text-xs text-amber-600">Importer: john.importer@test.com / Test123!</p>
            </div>

            <p className="mt-5 text-center text-sm text-gray-500">
              Don't have an account? <Link href="/register" className="text-brand font-semibold hover:underline">Create Account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

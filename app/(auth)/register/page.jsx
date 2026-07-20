'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { User, Mail, Lock, Phone, Globe, Building2, Leaf, MapPin } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [buyerType, setBuyerType] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', company: '', country: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, buyerType }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success('Account created! Signing you in...');
      await signIn('credentials', { email: form.email, password: form.password, redirect: false });
      router.push('/');
      router.refresh();
    } catch { toast.error('Registration failed. Please try again.'); }
    finally { setLoading(false); }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Leaf className="w-7 h-7 text-brand" />
            <span className="font-bold text-gray-900 text-xl">Shah International</span>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Create Your Account</h1>
            <p className="text-gray-500 text-sm text-center mb-8">First, tell us how you'll be using the platform</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => { setBuyerType('local'); setStep(2); }}
                className={`text-left border-2 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg ${buyerType === 'local' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                <div className="text-4xl mb-3">🇧🇩</div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  <h3 className="font-bold text-gray-900">Local Buyer</h3>
                </div>
                <p className="text-sm text-gray-500">I'm in Bangladesh and want to order with home delivery</p>
                <div className="mt-3 text-xs text-green-700 bg-green-100 rounded-lg px-3 py-1.5">Prices shown in BDT (৳) • Home Delivery</div>
              </button>
              <button onClick={() => { setBuyerType('international'); setStep(2); }}
                className={`text-left border-2 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg ${buyerType === 'international' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                <div className="text-4xl mb-3">🌍</div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-gray-900">International Buyer</h3>
                </div>
                <p className="text-sm text-gray-500">I'm outside Bangladesh and want to import products</p>
                <div className="mt-3 text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-1.5">Prices in USD ($) • Quotation & Export</div>
              </button>
            </div>
            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account? <Link href="/login" className="text-brand font-semibold hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Leaf className="w-7 h-7 text-brand" />
          <span className="font-bold text-gray-900 text-xl">Shah International</span>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-gray-500 text-sm">←</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Complete Registration</h1>
              <p className="text-xs text-gray-500">as {buyerType === 'local' ? '🇧🇩 Bangladesh Local Buyer' : '🌍 International Buyer/Importer'}</p>
            </div>
          </div>
          <form onSubmit={handleRegister} className="space-y-4">
            <Input label="Full Name" required icon={User} placeholder="John Doe" value={form.name} onChange={e => set('name', e.target.value)} />
            <Input label="Email Address" type="email" required icon={Mail} placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
            <Input label="Phone Number" icon={Phone} placeholder={buyerType === 'local' ? '+880 1XXX-XXXXXX' : '+1 234 567 8900'} value={form.phone} onChange={e => set('phone', e.target.value)} />
            {buyerType === 'international' && (
              <>
                <Input label="Company Name" icon={Building2} placeholder="Your company" value={form.company} onChange={e => set('company', e.target.value)} />
                <Input label="Country" icon={Globe} placeholder="Your country" value={form.country} onChange={e => set('country', e.target.value)} />
              </>
            )}
            <Input label="Password" type="password" required icon={Lock} placeholder="Min. 8 characters" value={form.password} onChange={e => set('password', e.target.value)} hint="Use a mix of letters, numbers, and symbols" />
            <Input label="Confirm Password" type="password" required icon={Lock} placeholder="Repeat password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
            <Button type="submit" variant="primary" className="w-full" loading={loading} size="lg">Create Account</Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account? <Link href="/login" className="text-brand font-semibold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

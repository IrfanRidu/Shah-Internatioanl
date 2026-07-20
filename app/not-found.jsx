import Link from 'next/link';
import { Leaf, Home, Package } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Leaf className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-8xl font-bold text-brand mb-2">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Page Not Found</h2>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)' }}>
            <Home className="w-4 h-4" /> Go Home
          </Link>
          <Link href="/products" className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 border-brand text-brand hover:bg-brand hover:text-white transition-all">
            <Package className="w-4 h-4" /> Browse Products
          </Link>
        </div>
      </div>
    </div>
  );
}

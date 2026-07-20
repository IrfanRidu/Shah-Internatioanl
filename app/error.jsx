'use client';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function Error({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' }}>
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>Something Went Wrong</h1>
        <p className="text-gray-500 mb-6 text-sm">{error?.message || 'An unexpected error occurred. Please try again.'}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="danger" size="sm">Try Again</Button>
          <Button onClick={() => window.location.href = '/'} variant="ghost" size="sm">Go Home</Button>
        </div>
      </div>
    </div>
  );
}

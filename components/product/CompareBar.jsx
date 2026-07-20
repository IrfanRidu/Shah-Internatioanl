'use client';
import { useCompareStore } from '@/store/compareStore';
import Link from 'next/link';
import Image from 'next/image';
import { X, GitCompareArrows } from 'lucide-react';

export default function CompareBar() {
  const { items, removeFromCompare, clearCompare } = useCompareStore();
  if (!items.length) return null;
  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 bg-gray-900 text-white border-t border-gray-700 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
          <GitCompareArrows className="w-4 h-4" /> Compare ({items.length}/3)
        </div>
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {items.map(p => (
            <div key={p._id} className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-1.5">
              {p.images?.[0] && (
                <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="32px" />
                </div>
              )}
              <span className="text-xs text-gray-200 max-w-[100px] truncate">{p.name}</span>
              <button onClick={() => removeFromCompare(p._id)} className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {/* Empty slots are informational only (not clickable) — use the
              compare icon on any product card to actually add it. Labeled
              clearly so it's not mistaken for a button that does nothing. */}
          {items.length < 3 && Array.from({ length: 3 - items.length }).map((_, i) => (
            <div key={i} className="w-32 h-9 border border-dashed border-gray-600 rounded-xl flex items-center justify-center text-xs text-gray-500 px-2 text-center leading-tight" title="Click the compare icon on a product card to add it here">
              Tap ⇄ on a product
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {items.length >= 2 && (
            <Link href="/products/compare" className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)' }}>
              Compare Now →
            </Link>
          )}
          <button onClick={clearCompare} className="text-xs text-gray-400 hover:text-white transition-colors">Clear All</button>
        </div>
      </div>
    </div>
  );
}

'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const range = Array.from({ length: Math.min(5, pages) }, (_, i) => {
    if (pages <= 5) return i + 1;
    if (page <= 3) return i + 1;
    if (page >= pages - 2) return pages - 4 + i;
    return page - 2 + i;
  });
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {range.map(p => (
        <button key={p} onClick={() => onChange(p)} className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${p === page ? 'text-white shadow-sm' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`} style={p === page ? { backgroundColor: 'var(--color-primary)' } : {}}>
          {p}
        </button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page === pages} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

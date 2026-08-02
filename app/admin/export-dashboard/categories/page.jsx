'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, ArrowLeft } from 'lucide-react';
import ExportCategorySection from '@/components/admin/export-settings/ExportCategorySection';

// Batch 7 — Export Category is now the export dashboard's central concept: different categories
// need different Packing List / Buyer's Invoice / BD Invoice document formats (one fixed format
// doesn't fit every product type), so categories get their own first-class page instead of being
// one tab buried inside generic Settings. The Shipment Details tab (inside each shipment) is the
// second, subordinate concept — every shipment picks one of these categories, and that choice
// determines what its documents look like.
export default function ExportCategoriesPage() {
  const [currency, setCurrency] = useState('BDT');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => setCurrency(d?.settings?.defaultCurrency || 'BDT')).catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/export-dashboard" className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-brand" /> Export Categories
          </h1>
          <p className="text-sm text-gray-500">The starting point for every shipment — pick or create a category first, then its document format, incentive math, and shipment card image all follow from it</p>
        </div>
      </div>

      <div className="mt-6">
        <ExportCategorySection currency={currency} />
      </div>
    </div>
  );
}

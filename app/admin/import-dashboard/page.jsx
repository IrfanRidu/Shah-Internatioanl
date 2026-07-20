import { Ship, Construction } from 'lucide-react';

export default function ImportDashboardPage() {
  return (
    <div className="max-w-2xl mx-auto py-20 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'var(--color-primary)' }}>
        <Ship className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
        Import Dashboard
      </h1>
      <div className="flex items-center justify-center gap-2 text-amber-500 mb-4">
        <Construction className="w-5 h-5" />
        <span className="font-semibold">Coming Soon</span>
      </div>
      <p className="text-gray-500 leading-relaxed">
        The full-scale import business dashboard is being built. It will include supplier management, purchase orders, import shipment tracking, customs documentation, cost analysis, and more.
      </p>
      <p className="text-sm text-gray-400 mt-4">
        Send your requirements and this dashboard will be built to your specification.
      </p>
    </div>
  );
}

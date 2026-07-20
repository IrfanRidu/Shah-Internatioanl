'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit2, Trash2, FileText, Package } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function BuyerShipmentsPage() {
  const { countryId, buyerId } = useParams();
  const router = useRouter();
  const [buyer, setBuyer] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [br, sr] = await Promise.all([
      fetch(`/api/export/buyers/${buyerId}`).then(r => r.json()),
      fetch(`/api/export/shipments?buyer=${buyerId}`).then(r => r.json()),
    ]);
    setBuyer(br.buyer);
    setShipments(sr.shipments || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [buyerId]);

  const handleDelete = async (s) => {
    if (!confirm(`Delete shipment ${s.shipmentNo}? This cannot be undone.`)) return;
    await fetch(`/api/export/shipments/${s._id}`, { method: 'DELETE' });
    fetchData(); toast.success('Shipment deleted');
  };

  const statusColor = { draft: 'default', active: 'info', completed: 'success', archived: 'default' };

  if (loading) return <div className="py-20"><Loader /></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push(`/admin/export-dashboard/countries/${countryId}`)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{buyer?.name}</h1>
          <p className="text-sm text-gray-500">{buyer?.address} · {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href={`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}/shipments/new`}>
          <Button variant="primary" icon={Plus}>New Shipment</Button>
        </Link>
      </div>

      {/* Shipments list */}
      <div className="space-y-3">
        {shipments.map(s => (
          <div key={s._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 dark:text-white">{s.shipmentNo}</p>
                    {s.invoiceNo && <span className="text-xs text-gray-400">Invoice: {s.invoiceNo}</span>}
                    <Badge variant={statusColor[s.status] || 'default'} className="text-xs capitalize">{s.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {s.date ? format(new Date(s.date), 'dd MMM yyyy') : '—'} · {s.finalDestination || s.country?.name}
                  </p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                    {s.totalNetWeightKg && <span>Net: {s.totalNetWeightKg} kg</span>}
                    {s.totalGrossWeightKg && <span>Gross: {s.totalGrossWeightKg} kg</span>}
                    {s.totalCTN && <span>CTN: {s.totalCTN}</span>}
                    {s.orderValueForeign && <span className="text-green-600 font-semibold">{s.orderCurrency || 'EUR'} {s.orderValueForeign?.toLocaleString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}/shipments/${s._id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-primary)' }}>
                  <FileText className="w-3.5 h-3.5" /> Documents
                </Link>
                <button onClick={() => handleDelete(s)} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {shipments.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No shipments yet for {buyer?.name}</p>
            <p className="text-sm mt-1">Create the first shipment to generate documents</p>
          </div>
        )}
      </div>
    </div>
  );
}

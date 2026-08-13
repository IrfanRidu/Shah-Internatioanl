'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, Package, Tag, Trash2, FileSignature, Pencil } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Batch 9 (R18): this is the old buyers/[buyerId]/page.jsx's shipment-list view, moved one level
// deeper under a specific Export Contract (country → buyer → Export Contract → shipments). The
// shipment-card JSX/filter-tabs/delete logic below is carried over essentially unchanged from that
// file — only the data source (contract-scoped instead of buyer-wide) and header changed.
// contractId === 'none' is the reserved fallback view for shipments predating this entity (see the
// buyer contracts-list page's own "Shipments without a Contract" card) — same page, no separate
// route, since ~95% of the logic is identical and a real contract is just absent in that case.
export default function ContractShipmentsPage() {
  const { countryId, buyerId, contractId } = useParams();
  const router = useRouter();
  const isUnassignedView = contractId === 'none';
  const [buyer, setBuyer] = useState(null);
  const [contract, setContract] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    const requests = [
      fetch(`/api/export/buyers/${buyerId}`).then(r => r.json()),
      fetch(`/api/export/shipments?buyer=${buyerId}&contract=${contractId}`).then(r => r.json()),
    ];
    if (!isUnassignedView) requests.push(fetch(`/api/export/contracts/${contractId}`).then(r => r.json()));
    const [br, sr, cr] = await Promise.all(requests);
    setBuyer(br.buyer);
    setShipments(sr.shipments || []);
    if (cr) setContract(cr.contract || null);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [buyerId, contractId]);

  const handleDelete = async (s) => {
    if (!confirm(`Delete shipment ${s.shipmentNo}? This cannot be undone.`)) return;
    const r = await fetch(`/api/export/shipments/${s._id}`, { method: 'DELETE' });
    const d = await r.json();
    if (d.success) { fetchData(); toast.success('Shipment deleted'); } else toast.error(d.message || 'Could not delete this shipment');
  };

  // Quick rename, right from the list — uses the dedicated shipmentNoOnly branch on the PUT route
  // (see app/api/export/shipments/[id]/route.js) rather than the general save path, which does a
  // full-document REPLACE and would need this list to hold an entire shipment's worth of data just
  // to change one label.
  const handleRename = async (s) => {
    const next = window.prompt('Rename shipment', s.shipmentNo);
    if (next === null) return; // cancelled
    const trimmed = next.trim();
    if (!trimmed || trimmed === s.shipmentNo) return;
    const r = await fetch(`/api/export/shipments/${s._id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentNoOnly: trimmed }),
    });
    const d = await r.json();
    if (d.success) { fetchData(); toast.success('Shipment renamed'); } else toast.error(d.message || 'Could not rename this shipment');
  };

  const statusColor = { draft: 'default', active: 'info', completed: 'success', archived: 'default' };

  const categoriesInUse = useMemo(() => {
    const seen = new Map();
    shipments.forEach(s => { if (s.exportCategory?._id && !seen.has(s.exportCategory._id)) seen.set(s.exportCategory._id, s.exportCategory); });
    return [...seen.values()];
  }, [shipments]);

  // R13: claimed-incentive shipments only show in Export Archive from here on — unchanged from the
  // pre-R18 buyer page.
  const visibleShipments = (categoryFilter === 'all' ? shipments : shipments.filter(s => s.exportCategory?._id === categoryFilter))
    .filter(s => s.incentiveApplication?.status !== 'claimed');

  if (loading) return <div className="py-20"><Loader /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push(`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}`)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileSignature className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {isUnassignedView ? 'Shipments without a Contract' : (contract?.contractNo || 'Export Contract')}
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            {buyer?.name}
            {!isUnassignedView && contract?.date && ` · ${format(new Date(contract.date), 'dd MMM yyyy')}`}
            {!isUnassignedView && contract?.value ? ` · ${contract.baseCurrency} ${contract.value.toLocaleString()}` : ''}
            {' '}· {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* No "New Shipment" here in the unassigned-legacy view — new shipments always get a real
            contract; this view exists purely to reassign old ones. */}
        {!isUnassignedView && (
          <Link href={`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}/shipments/new?contract=${contractId}`}>
            <Button variant="primary" icon={Plus}>New Shipment</Button>
          </Link>
        )}
      </div>

      {isUnassignedView && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
          These shipments were created before Export Contracts existed. Open each one and pick an Export Contract in its details to move it out of this list.
        </div>
      )}

      {categoriesInUse.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setCategoryFilter('all')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all ${categoryFilter === 'all' ? 'text-white' : 'text-gray-500 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100'}`}
            style={categoryFilter === 'all' ? { backgroundColor: 'var(--color-primary)' } : {}}>
            All ({shipments.length})
          </button>
          {categoriesInUse.map(c => {
            const count = shipments.filter(s => s.exportCategory?._id === c._id).length;
            const active = categoryFilter === c._id;
            return (
              <button key={c._id} onClick={() => setCategoryFilter(c._id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all ${active ? 'text-white' : 'text-gray-500 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100'}`}
                style={active ? { backgroundColor: 'var(--color-primary)' } : {}}>
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" className="w-4 h-4 rounded object-cover" />
                ) : <Tag className="w-3.5 h-3.5" />}
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {visibleShipments.map(s => (
          <div key={s._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: s.exportCategory?.image ? 'transparent' : 'var(--color-primary)' }}>
                  {s.exportCategory?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.exportCategory.image} alt={s.exportCategory.name} className="w-full h-full object-cover" />
                  ) : <Package className="w-5 h-5 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 dark:text-white">{s.shipmentNo}</p>
                    <button onClick={() => handleRename(s)} title="Rename shipment" className="p-1 rounded-lg text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {s.invoiceNo && <span className="text-xs text-gray-400">Invoice: {s.invoiceNo}</span>}
                    <Badge variant={statusColor[s.status] || 'default'} className="text-xs capitalize">{s.status}</Badge>
                    {s.exportCategory?.name && <span className="text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-lg">{s.exportCategory.name}</span>}
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

        {visibleShipments.length === 0 && shipments.length > 0 && (
          <div className="text-center py-16 text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No shipments in this category</p>
          </div>
        )}

        {shipments.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No shipments yet{isUnassignedView ? '' : ` under ${contract?.contractNo || 'this contract'}`}</p>
            {!isUnassignedView && <p className="text-sm mt-1">Create the first shipment to generate documents</p>}
          </div>
        )}
      </div>
    </div>
  );
}

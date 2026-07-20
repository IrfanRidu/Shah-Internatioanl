'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Pagination from '@/components/ui/Pagination';
import { format } from 'date-fns';
import { Phone, MessageSquare, RefreshCw, Eye, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOrderStream } from '@/hooks/useOrderStream';

// Status flow: processing → any status (admin can jump directly)
const STATUS_OPTIONS = ['all', 'processing', 'confirmed', 'cancelled', 'onTheWay', 'delivered', 'returned'];
const STATUS_LABELS = { processing: 'Processing', confirmed: 'Confirmed', cancelled: 'Cancelled', onTheWay: 'On the Way', delivered: 'Delivered', returned: 'Returned' };
const STATUS_EMOJI  = { processing: '⏳', confirmed: '✅', cancelled: '❌', onTheWay: '🚚', delivered: '📦', returned: '↩️' };
const STATUS_BADGE  = { processing: 'warning', confirmed: 'info', cancelled: 'danger', onTheWay: 'primary', delivered: 'success', returned: 'danger' };
export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  // Honor a ?status= query param on first load (e.g. the admin dashboard's "orders waiting for
  // confirmation" banner links here with ?status=processing) — without this, that link would always
  // land on the unfiltered "All" tab regardless of what it promised to show.
  const [statusFilter, setStatusFilter] = useState(() => {
    const fromQuery = searchParams.get('status');
    return STATUS_OPTIONS.includes(fromQuery) ? fromQuery : 'all';
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [updating, setUpdating] = useState({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page, limit: 20 });
    if (statusFilter !== 'all') p.set('status', statusFilter);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    const res = await fetch(`/api/orders?${p}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setTotal(data.total || 0);
    setPages(data.pages || 1);
    setLoading(false);
  }, [page, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Live order list: instant SSE push when available, 30s polling fallback otherwise.
  const { live } = useOrderStream({
    onNewOrder: (o) => {
      // Only toast for genuinely new orders landing on page 1 / unfiltered view,
      // to avoid noisy popups while an admin is mid-filter on an old page.
      if (page === 1 && statusFilter === 'all') toast(`🛎️ Order #${o.orderNumber} updated`, { icon: '📦' });
      fetchOrders();
    },
    onPoll: fetchOrders,
    pollInterval: 30000,
  });

  const updateStatus = async (orderId, status, note = '') => {
    setUpdating(p => ({ ...p, [orderId]: true }));
    const res = await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note }) });
    const data = await res.json();
    if (data.success) {
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: data.order?.status || status } : o));
      toast.success(`${STATUS_EMOJI[status]} Order → ${STATUS_LABELS[status]}`);
      // Trigger dashboard metrics to refresh in real time
      window.dispatchEvent(new CustomEvent('order-status-changed', { detail: { orderId, status } }));
    } else toast.error(data.message);
    setUpdating(p => ({ ...p, [orderId]: false }));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500">{total} total orders</p>
            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${live ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {live ? 'Live' : 'Polling (30s)'}
            </span>
          </div>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ backgroundColor: 'var(--color-primary)' }}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${statusFilter === s ? 'text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
              style={statusFilter === s ? { backgroundColor: 'var(--color-primary)' } : {}}>
              {s === 'all' ? 'All Orders' : `${STATUS_EMOJI[s]} ${STATUS_LABELS[s]}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-800 focus:outline-none" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-800 focus:outline-none" />
        </div>
      </div>

      {loading ? <Loader /> : (
        <div className="space-y-3">
          {orders.length === 0 && <div className="text-center py-16 text-gray-400">No orders found</div>}
          {orders.map(order => (
            <div key={order._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              {/* Order header */}
              <div className="flex flex-wrap items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => setExpandedId(expandedId === order._id ? null : order._id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 dark:text-white">#{order.orderNumber}</span>
                    <Badge variant={STATUS_BADGE[order.status] || 'default'} className="text-xs">{STATUS_EMOJI[order.status] || ''} {STATUS_LABELS[order.status] || order.status}</Badge>
                    {order.orderType === 'local' ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">🇧🇩 Local</span> : <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">🌍 Import</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{order.user?.name}</span>
                    <span className="text-xs text-gray-400">{format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}</span>
                    <span className="text-xs text-gray-400">{order.items?.length} item{order.items?.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-bold text-brand text-lg">৳{order.total?.toLocaleString()}</span>
                  {order.user?.phone && (
                    <a href={`tel:${order.user.phone}`} onClick={e => e.stopPropagation()} className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 transition-colors" title={`Call ${order.user.name}`}>
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  <a href={`https://wa.me/${order.user?.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${order.user?.name}, regarding your order #${order.orderNumber}`)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors" title="WhatsApp">
                    <MessageSquare className="w-4 h-4" />
                  </a>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === order._id ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === order._id && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Customer</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{order.user?.name}</p>
                      <p className="text-sm text-gray-500">{order.user?.email}</p>
                      <p className="text-sm text-gray-500">{order.user?.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Delivery Address</p>
                      {order.deliveryAddress && <div className="text-sm text-gray-600 dark:text-gray-300 space-y-0.5">
                        <p>{order.deliveryAddress.street}</p>
                        <p>{order.deliveryAddress.area && `${order.deliveryAddress.area}, `}{order.deliveryAddress.city}</p>
                        <p>{order.deliveryAddress.district}</p>
                      </div>}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</p>
                      {order.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                          <span className="truncate mr-2">{item.name} ×{item.quantity}</span>
                          <span className="flex-shrink-0">৳{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase self-center mr-1">Set Status:</p>
                    {Object.entries(STATUS_LABELS).filter(([s]) => s !== order.status).map(([statusKey, label]) => (
                      <button key={statusKey} disabled={updating[order._id]} onClick={() => updateStatus(order._id, statusKey)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 ${statusKey === 'cancelled' || statusKey === 'returned' ? 'bg-red-500 hover:bg-red-600' : statusKey === 'delivered' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        style={statusKey !== 'cancelled' && statusKey !== 'returned' && statusKey !== 'delivered' ? { backgroundColor: 'var(--color-primary)' } : {}}>
                        {STATUS_EMOJI[statusKey]} {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <Pagination page={page} pages={pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

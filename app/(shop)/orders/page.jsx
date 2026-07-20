'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import { Package, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = { pending: 'warning', confirmed: 'info', processing: 'info', onTheWay: 'primary', delivered: 'success', cancelled: 'danger', returned: 'danger' };
const STATUS_ICONS = { pending: '⏳', confirmed: '✅', processing: '⚙️', onTheWay: '🚚', delivered: '✔️', cancelled: '❌', returned: '↩️' };

export default function OrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const fetchOrders = async () => {
      const res = await fetch('/api/orders?limit=50');
      const data = await res.json();
      setOrders(data.orders || []);
      setLoading(false);
    };
    if (session) fetchOrders();
  }, [session]);

  // Order.status is never literally 'pending' (real enum: processing → confirmed/cancelled →
  // onTheWay → delivered/returned) — this tab was silently showing zero orders always.
  const tabs = ['all', 'processing', 'confirmed', 'onTheWay', 'delivered', 'cancelled'];
  const filtered = activeTab === 'all' ? orders : orders.filter(o => o.status === activeTab);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>My Orders</h1>
      <div className="flex gap-2 overflow-x-auto mb-6 pb-2">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all capitalize ${activeTab === tab ? 'text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600'}`} style={activeTab === tab ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {STATUS_ICONS[tab] || ''} {tab}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400">No orders found</p>
          <Link href="/products" className="mt-4 text-brand underline text-sm inline-block">Start Shopping →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => (
            <Link key={order._id} href={`/orders/${order._id}`} className="block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="font-bold text-gray-900 dark:text-white">#{order.orderNumber}</span>
                    <Badge variant={STATUS_COLORS[order.status] || 'default'}>{STATUS_ICONS[order.status]} {order.status}</Badge>
                    {order.paymentStatus === 'paid' && <Badge variant="success">💳 Paid</Badge>}
                  </div>
                  <p className="text-sm text-gray-500">{format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {order.items?.slice(0, 3).map((item, i) => (
                      <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{item.name} ×{item.quantity}</span>
                    ))}
                    {order.items?.length > 3 && <span className="text-xs text-gray-400">+{order.items.length - 3} more</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-brand text-lg">৳{order.total?.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{order.items?.length} item{order.items?.length !== 1 ? 's' : ''}</p>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-2" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

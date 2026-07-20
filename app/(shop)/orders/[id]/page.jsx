'use client';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';
import { MapPin, Package, CreditCard, X, Download, CheckCircle, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_BADGE = { pending: 'warning', confirmed: 'info', processing: 'info', onTheWay: 'primary', delivered: 'success', cancelled: 'danger', returned: 'danger' };
const STATUS_ICON = { pending: '⏳', confirmed: '✅', processing: '⚙️', onTheWay: '🚚', delivered: '🎉', cancelled: '❌', returned: '↩️' };
// Order.status real enum: processing (initial) → confirmed → onTheWay → delivered (cancelled/returned
// are terminal exits, not steps on this happy-path stepper). The old STEPS list included a non-existent
// 'pending' stage AND 'processing' as two separate steps — since new orders start at 'processing',
// that made STEPS.indexOf(order.status) resolve to index 2 of 4 immediately, so a brand-new order's
// progress bar showed 50% complete before anything had actually happened.
const STEPS = ['processing', 'confirmed', 'onTheWay', 'delivered'];
const STEP_LABELS = { processing: 'Order Placed', confirmed: 'Confirmed', onTheWay: 'On the Way', delivered: 'Delivered' };

export default function OrderDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get('payment') === 'success';
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${id}`).then(r => r.json()).then(d => { setOrder(d.order); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (paymentSuccess) toast.success('🎉 Payment successful! Your order is confirmed.');
  }, [paymentSuccess]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    const res = await fetch(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled', cancelReason: 'Cancelled by customer' }) });
    const data = await res.json();
    if (data.success) { setOrder(data.order); toast.success('Order cancelled'); } else toast.error(data.message);
    setCancelling(false);
  };

  const downloadInvoice = async () => {
    setDownloadingInvoice(true);
    try {
      const res = await fetch(`/api/orders/${id}/invoice`);
      const { order: orderData } = await res.json();
      const { generateOrderInvoicePDF } = await import('@/lib/invoice');
      const doc = generateOrderInvoicePDF(orderData);
      doc.save(`invoice-${orderData.orderNumber}.pdf`);
      toast.success('Invoice downloaded!');
    } catch (e) { toast.error('Failed to generate invoice'); }
    setDownloadingInvoice(false);
  };

  if (loading) return <div className="py-20"><Loader /></div>;
  if (!order) return <div className="py-20 text-center text-gray-400">Order not found</div>;

  const stepIdx = STEPS.indexOf(order.status);
  const isActive = !['cancelled', 'returned'].includes(order.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/orders" className="text-gray-400 hover:text-gray-600 text-sm">← My Orders</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order #{order.orderNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(order.createdAt), 'dd MMMM yyyy, hh:mm a')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={STATUS_BADGE[order.status] || 'default'} className="text-sm px-3 py-1.5">
            {STATUS_ICON[order.status]} {order.status}
          </Badge>
          <Button variant="outline" size="sm" icon={Download} loading={downloadingInvoice} onClick={downloadInvoice}>Invoice PDF</Button>
          {['processing', 'confirmed'].includes(order.status) && (
            <Button variant="danger" size="sm" loading={cancelling} onClick={handleCancel} icon={X}>Cancel</Button>
          )}
        </div>
      </div>

      {/* Payment success banner */}
      {paymentSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800 dark:text-green-400">Payment successful!</p>
            <p className="text-sm text-green-600 dark:text-green-300">Your order has been confirmed and is being prepared.</p>
          </div>
        </div>
      )}

      {/* Status stepper */}
      {isActive && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mb-6">
          <div className="relative flex items-center justify-between">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-100 dark:bg-gray-800" />
            <div className="absolute top-5 left-0 h-0.5 bg-brand transition-all duration-700" style={{ width: `${stepIdx > 0 ? (stepIdx / (STEPS.length - 1)) * 100 : 0}%` }} />
            {STEPS.map((step, i) => {
              const done = i < stepIdx, current = i === stepIdx;
              return (
                <div key={step} className="flex flex-col items-center relative z-10 gap-2 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 ${done ? 'text-white border-transparent' : current ? 'text-brand border-brand bg-green-50 dark:bg-green-900/30' : 'border-gray-200 bg-white dark:bg-gray-900 text-gray-300'}`} style={done ? { backgroundColor: 'var(--color-primary)' } : {}}>
                    {done ? '✓' : STATUS_ICON[step] || i + 1}
                  </div>
                  <span className={`text-xs capitalize text-center hidden sm:block font-medium ${current ? 'text-brand' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                    {STEP_LABELS[step] || step}
                  </span>
                </div>
              );
            })}
          </div>
          {order.status === 'onTheWay' && (
            <p className="text-center text-sm text-brand font-medium mt-4 bg-green-50 dark:bg-green-900/20 rounded-xl py-2">
              🚚 Your order is on the way! Our delivery partner will contact you shortly.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Items */}
        <div className="md:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Package className="w-4 h-4 text-brand" /> Order Items</h2>
          <div className="space-y-3">
            {order.items?.map((item, i) => (
              <div key={i} className="flex items-center gap-3 pb-3 border-b border-gray-50 dark:border-gray-800 last:border-0 last:pb-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative">
                  {item.image ? <Image src={item.image} alt={item.name} fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">×{item.quantity} {item.unit}</p>
                    {item.isPreOrder && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pre-Order</span>}
                  </div>
                </div>
                <p className="font-bold text-gray-900 dark:text-white text-sm">৳{(item.price * item.quantity)?.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>৳{order.subtotal?.toLocaleString()}</span></div>
            {order.couponDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Coupon ({order.couponCode})</span><span>-৳{order.couponDiscount}</span></div>}
            <div className="flex justify-between text-sm text-gray-500"><span>Delivery</span><span className={order.deliveryCharge === 0 ? 'text-green-600' : ''}>{order.deliveryCharge === 0 ? 'FREE' : `৳${order.deliveryCharge}`}</span></div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100 dark:border-gray-800">
              <span>Total</span><span className="text-brand">৳{order.total?.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand" /> Delivery Address</h2>
          {order.deliveryAddress && (
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5">
              <p className="font-bold text-gray-900 dark:text-white">{order.deliveryAddress.name}</p>
              <p>📞 {order.deliveryAddress.phone}</p>
              <p>{order.deliveryAddress.street}</p>
              {order.deliveryAddress.area && <p>{order.deliveryAddress.area}</p>}
              <p>{order.deliveryAddress.city}{order.deliveryAddress.district ? `, ${order.deliveryAddress.district}` : ''}</p>
              {order.deliveryAddress.zipCode && <p>ZIP: {order.deliveryAddress.zipCode}</p>}
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-brand" /> Payment</h2>
          <div className="text-sm space-y-3">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Method</span>
              <span className="font-medium capitalize text-gray-800 dark:text-white">{order.paymentMethod?.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Status</span>
              <Badge variant={order.paymentStatus === 'paid' ? 'success' : order.paymentStatus === 'failed' ? 'danger' : 'warning'} className="text-xs capitalize">
                {order.paymentStatus === 'paid' ? '✅ ' : order.paymentStatus === 'failed' ? '❌ ' : '⏳ '}{order.paymentStatus}
              </Badge>
            </div>
            {order.stripePaymentIntentId && (
              <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 font-mono break-all">
                {order.stripePaymentIntentId}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order history */}
      {order.statusHistory?.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">Order History</h2>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-100 dark:bg-gray-800" />
            {[...order.statusHistory].reverse().map((h, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-4 w-3 h-3 rounded-full border-2 border-brand bg-white dark:bg-gray-900 mt-1" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 dark:text-white text-sm capitalize">{STATUS_ICON[h.status]} {h.status}</span>
                    <span className="text-xs text-gray-400">{format(new Date(h.timestamp), 'dd MMM yyyy, hh:mm a')}</span>
                  </div>
                  {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

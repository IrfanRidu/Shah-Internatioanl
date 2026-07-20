'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, X, Package, AlertTriangle, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useOrderStream } from '@/hooks/useOrderStream';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);
  // Notifications the admin has already SEEN (opened the bell while it was showing, or clicked
  // through to it) — these stop counting toward the badge immediately, even before the underlying
  // order/message technically changes state server-side (issue 40: badge should clear once opened).
  const seenIds = useRef(new Set());

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const [ordersRes, inventoryRes, messagesRes] = await Promise.all([
        // Order.status is never literally 'pending' (real enum starts at 'processing') — this was
        // silently matching zero orders, so "new order" notifications never appeared at all.
        fetch('/api/orders?status=processing&limit=5'),
        fetch('/api/inventory?lowStock=true'),
        fetch('/api/messages?status=open&limit=5'),
      ]);
      const [orders, inventory, messagesData] = await Promise.all([ordersRes.json(), inventoryRes.json(), messagesRes.json()]);
      const notifs = [
        ...((orders.orders || []).map(o => ({ id: o._id, type: 'order', icon: Package, color: 'text-blue-500 bg-blue-50', title: `New Order #${o.orderNumber}`, desc: `৳${o.total?.toLocaleString()} · ${o.user?.name}`, time: o.createdAt, href: '/admin/orders' }))),
        ...((messagesData.conversations || []).filter(c => c.unreadByAdmin).slice(0, 5).map(c => ({ id: c._id, type: 'message', icon: MessageSquare, color: 'text-purple-500 bg-purple-50', title: `New message: ${c.subject}`, desc: `${c.user?.name} · ${c.lastMessage?.slice(0, 40)}`, time: c.lastMessageAt, href: `/admin/messages/${c._id}` }))),
        ...((inventory.inventory || []).filter(i => i.currentStock <= i.minimumStockAlert).slice(0, 3).map(i => ({ id: i._id, type: 'stock', icon: AlertTriangle, color: 'text-amber-500 bg-amber-50', title: 'Low Stock Alert', desc: `${i.product?.name}: ${i.currentStock} left`, href: '/admin/inventory' }))),
      ];
      setNotifications(notifs);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    // 60s safety-net poll stays in place even when SSE is live, since this
    // covers messages/inventory too (the stream only carries order events).
    const id = setInterval(fetchNotifications, 60000);
    return () => clearInterval(id);
  }, []);

  // Instant refresh the moment a new order lands, via the same SSE channel
  // the dashboard uses (falls back to the 60s poll above if unsupported).
  useOrderStream({
    onNewOrder: () => {
      fetchNotifications();
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);
    },
    enabled: true,
    pollInterval: 60000,
  });

  const unread = notifications.filter(n => !seenIds.current.has(n.id)).length;

  const handleToggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      fetchNotifications();
      // Opening the bell counts as "seen" for everything currently listed — the badge clears
      // immediately rather than waiting for the underlying order/message to change state elsewhere.
      notifications.forEach(n => seenIds.current.add(n.id));
    }
  };

  return (
    <div className="relative">
      <button onClick={handleToggleOpen} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative">
        {pulse && <span className="absolute inset-0 rounded-xl bg-green-400/30 animate-ping" />}
        <Bell className={`w-5 h-5 relative ${pulse ? 'text-green-600' : ''}`} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 z-50">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <p className="font-bold text-gray-900 dark:text-white text-sm">Notifications</p>
            <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center"><Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-gray-400 text-sm">All clear!</p></div>
            ) : notifications.map((n, i) => (
              <Link key={i} href={n.href} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${n.color}`}>
                  <n.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{n.title}</p>
                  <p className="text-xs text-gray-500 truncate">{n.desc}</p>
                  {n.time && <p className="text-xs text-gray-400 mt-0.5">{format(new Date(n.time), 'dd MMM, hh:mm a')}</p>}
                </div>
              </Link>
            ))}
          </div>
          <div className="p-3 border-t border-gray-100 dark:border-gray-800 text-center">
            <Link href="/admin/orders" onClick={() => setOpen(false)} className="text-xs text-brand hover:underline">View all orders →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

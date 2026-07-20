'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import { MessageSquare, ChevronRight, Phone, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ limit: 50 });
    if (filter !== 'all') q.set('status', filter);
    const res = await fetch(`/api/messages?${q}`);
    const data = await res.json();
    setConversations(data.conversations || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => { const id = setInterval(fetch_, 30000); return () => clearInterval(id); }, [fetch_]);

  const unreadCount = conversations.filter(c => c.unreadByAdmin).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <p className="text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount} unread conversation${unreadCount > 1 ? 's' : ''}` : 'All caught up'}</p>
        </div>
        <button onClick={fetch_} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {['open', 'closed', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${filter === f ? 'text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`} style={filter === f ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {f}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : conversations.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No messages" description="Customer conversations will appear here." />
      ) : (
        <div className="space-y-3">
          {conversations.map(c => (
            <Link key={c._id} href={`/admin/messages/${c._id}`} className={`block bg-white dark:bg-gray-900 rounded-2xl border p-5 hover:shadow-md transition-all ${c.unreadByAdmin ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-800'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                    {c.user?.name?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.user?.name}</p>
                      {c.unreadByAdmin && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />}
                      <Badge variant={c.user?.buyerType === 'international' ? 'info' : 'success'} className="text-xs">{c.user?.buyerType === 'international' ? '🌍' : '🇧🇩'}</Badge>
                      <Badge variant={c.status === 'open' ? 'success' : 'default'} className="text-xs">{c.status}</Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">{c.subject}</p>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{c.lastSenderRole === 'admin' ? 'You: ' : ''}{c.lastMessage}</p>
                    {c.product && <p className="text-xs text-gray-400 mt-1">Re: {c.product.name}</p>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                  <p className="text-xs text-gray-400">{format(new Date(c.lastMessageAt), 'dd MMM, hh:mm a')}</p>
                  {c.user?.phone && (
                    <a href={`tel:${c.user.phone}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 transition-colors">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

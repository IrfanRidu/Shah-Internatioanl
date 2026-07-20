'use client';
import { useState, useEffect, useCallback } from 'react';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import StarRating from '@/components/product/StarRating';
import Button from '@/components/ui/Button';
import { CheckCircle, XCircle, MessageSquare, RefreshCw, Shield } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [replyModal, setReplyModal] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page, limit: 20 });
    if (filter !== 'all') q.set('approved', filter === 'approved' ? 'true' : 'false');
    const res = await fetch(`/api/admin/reviews?${q}`);
    const data = await res.json();
    setReviews(data.reviews || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleApprove = async (id, approve) => {
    const res = await fetch(`/api/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isApproved: approve }) });
    if (res.ok) { toast.success(approve ? 'Review approved!' : 'Review rejected'); fetch_(); }
    else toast.error('Failed');
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/reviews/${replyModal._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminReply: replyText, isApproved: true }) });
    setSaving(false);
    if (res.ok) { toast.success('Reply saved!'); setReplyModal(null); setReplyText(''); fetch_(); }
    else toast.error('Failed');
  };

  const tabs = [
    { key: 'pending', label: '⏳ Pending', color: 'warning' },
    { key: 'approved', label: '✅ Approved', color: 'success' },
    { key: 'all', label: 'All', color: 'default' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reviews</h1>
          <p className="text-sm text-gray-500">{total} total reviews</p>
        </div>
        <button onClick={fetch_} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setFilter(t.key); setPage(1); }} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === t.key ? 'text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`} style={filter === t.key ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <div className="space-y-4">
          {reviews.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No reviews found</p>
            </div>
          )}
          {reviews.map(review => (
            <div key={review._id} className={`bg-white dark:bg-gray-900 rounded-2xl border p-5 ${!review.isApproved ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10' : 'border-gray-100 dark:border-gray-800'}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                    {review.user?.name?.[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">{review.user?.name}</span>
                      {review.isVerified && <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full"><Shield className="w-3 h-3" /> Verified</span>}
                      <Badge variant={review.isApproved ? 'success' : 'warning'} className="text-xs">{review.isApproved ? '✅ Approved' : '⏳ Pending'}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarRating rating={review.rating} size="sm" />
                      <span className="text-xs text-gray-400">{format(new Date(review.createdAt), 'dd MMM yyyy')}</span>
                    </div>
                    {review.product && <p className="text-xs text-gray-400 mt-0.5">Product: {review.product?.name || 'Unknown'}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!review.isApproved && (
                    <button onClick={() => handleApprove(review._id, true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-100 text-green-700 hover:bg-green-200 text-xs font-semibold transition-all">
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                  {review.isApproved && (
                    <button onClick={() => handleApprove(review._id, false)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 text-xs font-semibold transition-all">
                      <XCircle className="w-3.5 h-3.5" /> Unpublish
                    </button>
                  )}
                  <button onClick={() => { setReplyModal(review); setReplyText(review.adminReply || ''); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition-all">
                    <MessageSquare className="w-3.5 h-3.5" /> {review.adminReply ? 'Edit Reply' : 'Reply'}
                  </button>
                </div>
              </div>

              {review.title && <p className="font-semibold text-gray-800 dark:text-white text-sm mt-3">{review.title}</p>}
              {review.comment && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">{review.comment}</p>}
              {review.adminReply && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border-l-4 border-brand">
                  <p className="text-xs font-semibold text-brand mb-1">Your reply:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{review.adminReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply modal */}
      {replyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setReplyModal(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-900 dark:text-white mb-2">Reply to Review</h2>
            <p className="text-sm text-gray-500 mb-4">From: {replyModal.user?.name} · "{replyModal.comment?.slice(0, 60)}..."</p>
            <textarea rows={4} value={replyText} onChange={e => setReplyText(e.target.value)} className="input-field resize-none mb-4" placeholder="Write your official reply..." />
            <div className="flex gap-3">
              <Button onClick={handleReply} loading={saving} variant="primary">Save Reply</Button>
              <Button onClick={() => setReplyModal(null)} variant="ghost">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import StarRating from './StarRating';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { CheckCircle, MessageSquare, ThumbsUp, Shield } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ReviewSection({ productId }) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ rating: 5, title: '', comment: '' });

  const fetchReviews = async () => {
    setLoading(true);
    const res = await fetch(`/api/reviews?product=${productId}&page=${page}`);
    const data = await res.json();
    setReviews(data.reviews || []);
    setStats(data.stats);
    setPages(data.pages || 1);
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, [productId, page]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session) { toast.error('Please login to submit a review'); return; }
    if (!form.rating) { toast.error('Please select a rating'); return; }
    setSubmitting(true);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, ...form }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.success) {
      toast.success(data.message);
      setShowForm(false);
      setForm({ rating: 5, title: '', comment: '' });
      fetchReviews();
    } else toast.error(data.message);
  };

  const ratingBars = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: stats ? (stats[`r${r}`] || 0) : 0,
    pct: stats?.count ? Math.round((stats[`r${r}`] || 0) / stats.count * 100) : 0,
  }));

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 mt-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand" /> Customer Reviews
          {stats?.count > 0 && <span className="text-sm font-normal text-gray-400">({stats.count})</span>}
        </h2>
        {session && !showForm && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>Write a Review</Button>
        )}
      </div>

      {/* Rating summary */}
      {stats?.count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl">
          <div className="text-center">
            <div className="text-6xl font-bold text-gray-900 dark:text-white mb-1">{stats.avg?.toFixed(1)}</div>
            <StarRating rating={stats.avg || 0} size="lg" />
            <p className="text-sm text-gray-500 mt-2">{stats.count} review{stats.count !== 1 ? 's' : ''}</p>
          </div>
          <div className="space-y-2">
            {ratingBars.map(({ rating, count, pct }) => (
              <div key={rating} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-500 w-4">{rating}</span>
                <StarRating rating={rating} size="sm" />
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-8">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Your Review</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rating</label>
            <StarRating rating={form.rating} size="lg" interactive onChange={r => setForm(p => ({ ...p, rating: r }))} />
          </div>
          <div className="mb-3">
            <input type="text" placeholder="Review title (optional)" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="input-field text-sm" />
          </div>
          <div className="mb-4">
            <textarea rows={4} placeholder="Share your experience with this product..." value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} className="input-field text-sm resize-none" />
          </div>
          <div className="flex gap-3">
            <Button type="submit" variant="primary" size="sm" loading={submitting}>Submit Review</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No reviews yet. Be the first to review!</p>
          {session && !showForm && <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowForm(true)}>Write a Review</Button>}
        </div>
      ) : (
        <div className="space-y-5">
          {reviews.map(review => (
            <div key={review._id} className="pb-5 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                    {review.user?.name?.[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{review.user?.name}</span>
                      {review.isVerified && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                          <Shield className="w-3 h-3" /> Verified Purchase
                        </span>
                      )}
                      {review.user?.buyerType === 'international' && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">🌍 Importer</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarRating rating={review.rating} size="sm" />
                      <span className="text-xs text-gray-400">{format(new Date(review.createdAt), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                </div>
              </div>
              {review.title && <h4 className="font-semibold text-gray-800 dark:text-white text-sm mt-3 mb-1">{review.title}</h4>}
              {review.comment && <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{review.comment}</p>}
              {review.adminReply && (
                <div className="mt-3 ml-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border-l-3 border-brand">
                  <p className="text-xs font-semibold text-brand mb-1">🌿 Shah International replied:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{review.adminReply}</p>
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

'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Zap } from 'lucide-react';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { isProductVisibleToBuyer } from '@/lib/utils';
import CountdownTimer from '@/components/ui/CountdownTimer';

// Condensed version of the homepage's FlashSaleSection, sized for embedding
// partway down a product detail page rather than as a full-width hero band.
export default function ActiveCampaignsStrip({ campaigns: campaignsProp, excludeId, limit = 3 }) {
  const [fetchedCampaigns, setFetchedCampaigns] = useState([]);
  const [loading, setLoading] = useState(!campaignsProp);
  const { buyerType, isLocal } = useBuyerType();

  useEffect(() => {
    // Normal path now: the product detail page already computed this list server-side, pre-filtered
    // against every other section on the page (issue 32) — nothing to fetch. Only a caller that
    // doesn't supply `campaigns` falls back to the old self-fetch (unfiltered against sibling
    // sections, since it has no visibility into what they used).
    if (campaignsProp) { setLoading(false); return; }
    fetch('/api/flash-sales?active=true', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const live = (d.sales || []).filter(s => (s.targetAudience || 'all') === 'all' || s.targetAudience === buyerType);
        setFetchedCampaigns(live.slice(0, limit));
      })
      .catch(() => setFetchedCampaigns([]))
      .finally(() => setLoading(false));
  }, [campaignsProp, buyerType, limit]);

  const campaigns = campaignsProp || fetchedCampaigns;
  if (loading || campaigns.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-red-500" fill="currentColor" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Campaigns</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaigns.map(c => {
          const items = (c.items || []).filter(i => i.product && String(i.product._id) !== String(excludeId));
          if (items.length === 0) return null;
          const bg = c.backgroundColor || '#1a1a2e';
          const textColor = c.textColor || '#ffffff';
          const badgeColor = c.badgeColor || '#ef4444';
          const badgeTextColor = c.badgTextColor || '#ffffff';
          const firstProduct = items[0].product;

          return (
            <Link
              key={c._id}
              href={`/products/${firstProduct.slug}`}
              className="rounded-2xl overflow-hidden relative block hover:opacity-95 transition-opacity"
              style={{ backgroundColor: bg }}
            >
              {c.bannerImage && (
                <div className="absolute inset-0 opacity-15">
                  <Image src={c.bannerImage} alt="" fill className="object-cover" sizes="300px" />
                </div>
              )}
              <div className="p-4 relative">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: badgeColor, color: badgeTextColor }}>
                  {c.badgeText || 'SALE'}
                </span>
                <h3 className="font-bold mt-2 mb-1 truncate" style={{ color: textColor }}>{c.displayName || c.title}</h3>
                <div className="scale-90 origin-left">
                  <CountdownTimer endTime={c.endTime} />
                </div>
                <p className="text-xs mt-2 opacity-70" style={{ color: textColor }}>{items.length} product{items.length > 1 ? 's' : ''} on offer</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

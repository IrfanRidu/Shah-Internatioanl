'use client';
import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { isProductVisibleToBuyer, isCampaignVisibleToBuyer } from '@/lib/utils';
import FlashSaleSection from '@/components/home/FlashSaleSection';

// Issue 2 fix: this used to render one generic link-card per campaign (badge + title + countdown +
// "N products on offer" text) with NO actual product image/name/price shown anywhere — which is
// exactly what was reported ("only date and time... without any products"). It now renders each
// campaign with the SAME real-product-cards + auto-scroll-with-pause-on-hover/touch treatment as the
// homepage's FlashSaleSection (issue 12), just reused directly so the two can never drift apart
// again, stacked one below another instead of the old 3-column grid of link-boxes.
export default function ActiveCampaignsStrip({ campaigns: campaignsProp, excludeId, limit = 3 }) {
  const [fetchedCampaigns, setFetchedCampaigns] = useState([]);
  const [loading, setLoading] = useState(!campaignsProp);
  const { buyerType } = useBuyerType();

  useEffect(() => {
    // Normal path: the product detail page already computed this list server-side, pre-filtered
    // against every other section on the page (issue 32 from an earlier batch) — nothing to fetch.
    // Only a caller that doesn't supply `campaigns` falls back to the old self-fetch.
    if (campaignsProp) { setLoading(false); return; }
    fetch('/api/flash-sales?active=true', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setFetchedCampaigns(d.sales || []))
      .catch(() => setFetchedCampaigns([]))
      .finally(() => setLoading(false));
  }, [campaignsProp]);

  const source = campaignsProp || fetchedCampaigns;

  // Issue 11: a campaign can be restricted to local-only or international-only buyers via its own
  // targetAudience field, independent of per-product availability. This filter previously only ran
  // inside the self-fetch branch above (which the normal campaignsProp-supplied flow never reaches),
  // so it's now applied unconditionally here regardless of where the data came from — this is also
  // the only place a GUEST's true buyer type (localStorage-only, per BuyerTypeContext) can be checked
  // at all, since the server component that supplies campaignsProp can't see it.
  const campaigns = source
    .filter(c => isCampaignVisibleToBuyer(c, buyerType))
    .map(c => ({
      ...c,
      items: (c.items || []).filter(i =>
        i.product &&
        String(i.product._id) !== String(excludeId) &&
        isProductVisibleToBuyer(i.product, buyerType)
      ),
    }))
    .filter(c => c.items.length > 0)
    .slice(0, limit);

  if (loading || campaigns.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      <div className="flex items-center gap-2 px-4 md:px-0">
        <Zap className="w-5 h-5 text-red-500" fill="currentColor" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Campaigns</h2>
      </div>
      {campaigns.map(c => <FlashSaleSection key={c._id} sale={c} />)}
    </div>
  );
}

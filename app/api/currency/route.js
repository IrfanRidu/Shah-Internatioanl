import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CurrencyRate from '@/models/CurrencyRate';
import { fetchLiveRates, STATIC_FALLBACK } from '@/lib/exchangeRates';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

// How long a cached rate is trusted before we try to refresh it from a live source again.
// Real upstream providers (see lib/exchangeRates.js) only update once every hour-to-day anyway, so
// 30 minutes keeps the site "live" without hammering free APIs on every page load.
const STALE_AFTER_MS = 30 * 60 * 1000;

export async function GET() {
  try {
    await connectDB();
    let rateDoc = await CurrencyRate.findOne().sort('-lastUpdated');
    const isStale = !rateDoc || (Date.now() - new Date(rateDoc.lastUpdated).getTime() > STALE_AFTER_MS);

    if (isStale) {
      const live = await fetchLiveRates();
      if (live) {
        rateDoc = await CurrencyRate.findOneAndUpdate(
          {},
          { rates: live.rates, lastUpdated: new Date(), base: 'USD', source: live.source },
          { upsert: true, new: true }
        );
      }
      // If every live provider failed, we simply keep serving the last cached `rateDoc` (if any) below
      // instead of overwriting good data with nothing — the next request will try again.
    }

    const rates = rateDoc?.rates || STATIC_FALLBACK;
    return NextResponse.json({
      success: true,
      rates,
      lastUpdated: rateDoc?.lastUpdated || null,
      source: rateDoc?.source || (rateDoc ? 'cached' : 'static-fallback'),
    });
  } catch (error) {
    // Even on a hard error, return usable (labeled) rates so the storefront never breaks on price display.
    return NextResponse.json({ success: false, message: error.message, rates: STATIC_FALLBACK, source: 'static-fallback' }, { status: 500 });
  }
}

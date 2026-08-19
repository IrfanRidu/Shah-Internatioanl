import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import ExportCountry from '@/models/ExportCountry';
import ExportBuyer from '@/models/ExportBuyer';
import ExportCategory from '@/models/ExportCategory';
import IncentiveApplication from '@/models/IncentiveApplication';
import { resolveEffectiveRateBDT, calculateIncentiveCosting } from '@/lib/incentiveUtils';
import { fetchLiveRates, STATIC_FALLBACK } from '@/lib/exchangeRates';

// Force dynamic rendering — reads live DB/session data on every request (same reasoning as every
// other route in this app that calls getServerSession — see PROJECT_STATUS.md batch 13).
export const dynamic = 'force-dynamic';

// Batch 19 (R33-5): Export Dashboard > Overview's aggregation endpoint. Deliberately duplicates the
// tiny toBaseCurrency helper from app/api/export/analytics/route.js (Issue 47) rather than
// refactoring that already-working route to export it — this is a small, self-contained function,
// and touching a working route to share 4 lines carries more risk than it saves.
function toBaseCurrency(amountBDT, baseCurrency, rates) {
  if (!baseCurrency || baseCurrency === 'BDT') return amountBDT;
  const bdtRate = rates.BDT || STATIC_FALLBACK.BDT;
  const baseRate = rates[baseCurrency] || STATIC_FALLBACK[baseCurrency] || 1;
  return (amountBDT / bdtRate) * baseRate;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin', 'editor'].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();

    let rates = STATIC_FALLBACK;
    try {
      const live = await fetchLiveRates();
      if (live?.rates) rates = live.rates;
    } catch { /* keep STATIC_FALLBACK — fetchLiveRates itself never throws, but be defensive anyway */ }
    // USD is used as the one common currency for every aggregate figure below — shipments can each
    // have their own baseCurrency (EUR/USD/GBP/etc.), and a single "Total Export Value" KPI only
    // means anything once everything is normalized to one shared currency. toBaseCurrency expects a
    // BDT amount; shipment values aren't BDT, so this inlines the direct currency->USD conversion
    // instead (rates are already USD-based: rates.EUR is "EUR per 1 USD", so amount/rate converts
    // FROM that currency TO USD).
    const toUSD = (amount, currency) => {
      if (!amount) return 0;
      if (!currency || currency === 'USD') return amount;
      const r = rates[currency] || STATIC_FALLBACK[currency];
      return r ? amount / r : amount; // no known rate for this currency — show face value rather than silently zeroing it
    };

    const shipments = await ExportShipment.find({})
      .populate('country', 'name flag')
      .populate('exportCategory', 'name')
      .populate('buyer', 'name')
      .select('items country exportCategory buyer baseCurrency date status createdAt')
      .lean();

    const computed = shipments.map((s) => {
      const items = (s.items || []).filter((i) => i.productName);
      const totalValue = items.reduce((a, i) => a + (Number(i.totalValue) || 0), 0);
      const totalCTN = items.reduce((a, i) => a + (Number(i.totalCTN) || 0), 0);
      const totalWeightKg = items.reduce((a, i) => a + (Number(i.quantityKg) || 0), 0);
      return { ...s, totalValue, totalValueUSD: toUSD(totalValue, s.baseCurrency), totalCTN, totalWeightKg };
    });
    // "Export-related KPI overview" reasonably means real, counted shipments — draft shipments
    // (still being drafted, not yet an actual export) are excluded from every KPI/breakdown below,
    // same reasoning ExportShipment.status's own enum comment gives for that state.
    const live = computed.filter((s) => s.status !== 'draft');

    // ---- Headline KPIs ----
    const totalShipments = live.length;
    const totalValueUSD = live.reduce((a, s) => a + s.totalValueUSD, 0);
    const totalWeightKg = live.reduce((a, s) => a + s.totalWeightKg, 0);
    const totalCTN = live.reduce((a, s) => a + s.totalCTN, 0);
    const avgShipmentValueUSD = totalShipments ? totalValueUSD / totalShipments : 0;
    const countrySet = new Set(live.map((s) => (s.country?._id ? String(s.country._id) : s.country?.name)).filter(Boolean));
    const buyerSet = new Set(live.map((s) => (s.buyer?._id ? String(s.buyer._id) : s.buyer?.name)).filter(Boolean));

    // ---- 12-month trend (export volume and shipment trends) ----
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), shipments: 0, valueUSD: 0, weightKg: 0 });
    }
    const monthIndex = Object.fromEntries(months.map((m, i) => [m.key, i]));
    live.forEach((s) => {
      const d = new Date(s.date || s.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const idx = monthIndex[key];
      if (idx !== undefined) {
        months[idx].shipments += 1;
        months[idx].valueUSD += s.totalValueUSD;
        months[idx].weightKg += s.totalWeightKg;
      }
    });

    // ---- Country/market-wise performance ----
    const byCountry = {};
    live.forEach((s) => {
      const name = s.country?.name || 'Unspecified';
      if (!byCountry[name]) byCountry[name] = { name, flag: s.country?.flag || '', shipments: 0, valueUSD: 0 };
      byCountry[name].shipments += 1;
      byCountry[name].valueUSD += s.totalValueUSD;
    });
    const countryBreakdown = Object.values(byCountry).sort((a, b) => b.valueUSD - a.valueUSD).slice(0, 10);

    // ---- Product/category performance ----
    const byCategory = {};
    live.forEach((s) => {
      const name = s.exportCategory?.name || 'Uncategorized';
      if (!byCategory[name]) byCategory[name] = { name, shipments: 0, valueUSD: 0, ctn: 0 };
      byCategory[name].shipments += 1;
      byCategory[name].valueUSD += s.totalValueUSD;
      byCategory[name].ctn += s.totalCTN;
    });
    const categoryBreakdown = Object.values(byCategory).sort((a, b) => b.valueUSD - a.valueUSD);

    // ---- Top buyers ("other relevant export metrics") ----
    const byBuyer = {};
    live.forEach((s) => {
      const name = s.buyer?.name || 'Unspecified';
      if (!byBuyer[name]) byBuyer[name] = { name, shipments: 0, valueUSD: 0 };
      byBuyer[name].shipments += 1;
      byBuyer[name].valueUSD += s.totalValueUSD;
    });
    const topBuyers = Object.values(byBuyer).sort((a, b) => b.valueUSD - a.valueUSD).slice(0, 5);

    // ---- Shipment status breakdown ("other relevant export metrics") ----
    const statusBreakdown = {};
    computed.forEach((s) => { statusBreakdown[s.status] = (statusBreakdown[s.status] || 0) + 1; });

    // ---- Incentive-related overview ----
    // Reuses the exact same formula the Incentive Application detail page itself uses
    // (lib/incentiveUtils.js's calculateIncentiveCosting) rather than a separate, simplified guess
    // at the math. For a 'documentation' (not yet claimed) application with no manual rate set, the
    // fallback "own rate" uses its first member shipment's exchangeRateBDT as a representative
    // proxy — precise enough for an aggregate overview card; the application's own detail page
    // remains the source of truth for any individual application's exact figures.
    let applications = [];
    try {
      applications = await IncentiveApplication.find({})
        .populate('exportCategory', 'incentivePercentage taxPercentage incentiveApplicationCost othersCost name')
        .populate('shipments', 'orderValueForeign freightCost exchangeRateBDT')
        .select('status title applicationNumber exportCategory shipments manualRateBDT lockedRateBDT kaForm.commissionInsuranceValue')
        .lean();
    } catch { applications = []; }

    let incentiveTotalBDT = 0;
    let incentiveClaimedBDT = 0;
    const incentiveByStatus = { documentation: 0, claimed: 0 };
    applications.forEach((app) => {
      incentiveByStatus[app.status] = (incentiveByStatus[app.status] || 0) + 1;
      const memberShipments = app.shipments || [];
      const effectiveRate = resolveEffectiveRateBDT(memberShipments[0] || {}, app);
      const costing = calculateIncentiveCosting({
        shipments: memberShipments,
        category: app.exportCategory,
        effectiveRateBDT: effectiveRate,
        commissionInsuranceValue: app.kaForm?.commissionInsuranceValue,
      });
      const amount = Math.max(0, costing.afterCostingBDT);
      incentiveTotalBDT += amount;
      if (app.status === 'claimed') incentiveClaimedBDT += amount;
    });

    return NextResponse.json({
      success: true,
      kpis: {
        totalShipments, totalValueUSD, totalWeightKg, totalCTN, avgShipmentValueUSD,
        totalCountries: countrySet.size, totalBuyers: buyerSet.size,
      },
      trend: months,
      countryBreakdown,
      categoryBreakdown,
      topBuyers,
      statusBreakdown,
      incentives: {
        totalBDT: incentiveTotalBDT,
        claimedBDT: incentiveClaimedBDT,
        pendingBDT: incentiveTotalBDT - incentiveClaimedBDT,
        applicationCount: applications.length,
        byStatus: incentiveByStatus,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

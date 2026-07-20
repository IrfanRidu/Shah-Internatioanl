import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportShipment from '@/models/ExportShipment';
import Settings from '@/models/Settings';
import { calculateShipmentFinancials } from '@/lib/utils';
import { fetchLiveRates, STATIC_FALLBACK } from '@/lib/exchangeRates';

// Issue 47: convert a BDT amount into the selected base currency using live market rates (never a
// hardcoded ratio). `rates` is USD-based (rates.USD === 1); BDT→base = amountBDT / rates.BDT * rates[base].
function toBaseCurrency(amountBDT, baseCurrency, rates) {
  if (!baseCurrency || baseCurrency === 'BDT') return amountBDT;
  const bdtRate = rates.BDT || STATIC_FALLBACK.BDT;
  const baseRate = rates[baseCurrency] || STATIC_FALLBACK[baseCurrency] || 1;
  return (amountBDT / bdtRate) * baseRate;
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear();
    const countryId = searchParams.get('country');
    const buyerId = searchParams.get('buyer');

    const settings = await Settings.findOne().lean();
    const initialBalance = settings?.exportAnalyticsInitialBalance || 0;
    // Issue 47: base currency can be previewed via ?baseCurrency= without saving it (frontend selector
    // does this while the admin is trying options), but always falls back to the persisted setting.
    const baseCurrency = searchParams.get('baseCurrency') || settings?.exportAnalyticsBaseCurrency || 'BDT';

    let rates = STATIC_FALLBACK;
    try {
      const live = await fetchLiveRates();
      if (live?.rates) rates = live.rates;
    } catch { /* keep STATIC_FALLBACK */ }

    const matchStage = {
      date: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31T23:59:59`),
      },
    };
    if (countryId) matchStage.country = countryId;
    if (buyerId) matchStage.buyer = buyerId;

    const rows = await ExportShipment.find(matchStage)
      .populate('buyer', 'name currency')
      .populate('country', 'name code flag')
      .sort({ date: 1 })
      .lean();

    // Issue 46: rebuilt row shape matching the exact spec column order/formulas. Every cost/profit/
    // capital-gain figure is converted into the selected base currency EXCEPT Order Value, which
    // always stays in the shipment's own configured currency (issue 47's explicit exception).
    // Financials are recomputed here (not just read from the stored fields) so a shipment saved
    // before the Initial Balance was last changed still reflects the CURRENT principal, matching
    // "used as the default principal for future calculations until updated by the user".
    const analytics = rows.map(s => {
      const computed = calculateShipmentFinancials({
        initialBalance,
        freightCost: s.freightCost, goodsCost: s.goodsCost, exportProcessingCost: s.exportProcessingCost,
        othersCost: s.othersCost, damage: s.damage, orderValueForeign: s.orderValueForeign,
        exchangeRateBDT: s.exchangeRateBDT, incentive: s.incentive,
      });
      const conv = (v) => toBaseCurrency(v || 0, baseCurrency, rates);
      return {
        _id: s._id,
        shipmentNo: s.shipmentNo,
        month: new Date(s.date).toLocaleString('en-US', { month: 'long' }),
        company: s.buyer?.name || '—',
        country: s.country?.name || '—',
        flag: s.country?.flag || '',
        date: s.date,
        totalNetWeightKg: s.totalNetWeightKg || 0,
        totalGrossWeightKg: s.totalGrossWeightKg || 0,
        freightCost: conv(s.freightCost),
        goodsCost: conv(s.goodsCost),
        exportProcessingCost: conv(s.exportProcessingCost),
        othersCost: conv(s.othersCost),
        damage: conv(s.damage),
        totalCost: conv(computed.totalCost),
        // Order Value: NEVER converted — always the shipment's own currency (issue 47)
        orderValueForeign: s.orderValueForeign || 0,
        orderCurrency: s.orderCurrency || 'EUR',
        exchangeRateBDT: s.exchangeRateBDT || 0,
        receiveAmountBDT: conv(computed.receiveAmountBDT),
        availableBalance: conv(computed.availableBalance),
        shipmentMargin: conv(computed.shipmentMargin),
        incentive: conv(s.incentive),
        netProfit: conv(computed.netProfit),
      };
    });

    const totals = analytics.reduce((acc, r) => {
      acc.freightCost += r.freightCost; acc.goodsCost += r.goodsCost; acc.exportProcessingCost += r.exportProcessingCost;
      acc.othersCost += r.othersCost; acc.damage += r.damage; acc.totalCost += r.totalCost;
      acc.receiveAmountBDT += r.receiveAmountBDT; acc.availableBalance += r.availableBalance;
      acc.shipmentMargin += r.shipmentMargin; acc.incentive += r.incentive; acc.netProfit += r.netProfit;
      acc.totalNetWeightKg += r.totalNetWeightKg; acc.totalGrossWeightKg += r.totalGrossWeightKg;
      return acc;
    }, { freightCost: 0, goodsCost: 0, exportProcessingCost: 0, othersCost: 0, damage: 0, totalCost: 0, receiveAmountBDT: 0, availableBalance: 0, shipmentMargin: 0, incentive: 0, netProfit: 0, totalNetWeightKg: 0, totalGrossWeightKg: 0 });

    return NextResponse.json({ success: true, rows: analytics, totals, year, initialBalance, baseCurrency });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

// Issue 46/47: update the persisted Initial Balance and/or base currency. Kept as its own endpoint
// (rather than reusing the generic /api/settings PUT) so the Analytics page can validate/round the
// principal specifically and so the audit trail for this dashboard-critical value is unambiguous.
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    await connectDB();
    const body = await request.json();
    const update = {};
    if (body.initialBalance !== undefined) {
      const val = Number(body.initialBalance);
      if (!Number.isFinite(val) || val < 0) return NextResponse.json({ success: false, message: 'Initial Balance must be a non-negative number' }, { status: 400 });
      update.exportAnalyticsInitialBalance = val;
    }
    if (body.baseCurrency !== undefined) update.exportAnalyticsBaseCurrency = body.baseCurrency;
    const settings = await Settings.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true });
    return NextResponse.json({ success: true, initialBalance: settings.exportAnalyticsInitialBalance, baseCurrency: settings.exportAnalyticsBaseCurrency });
  } catch (e) { return NextResponse.json({ success: false, message: e.message }, { status: 500 }); }
}

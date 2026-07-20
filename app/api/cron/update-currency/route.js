import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CurrencyRate from '@/models/CurrencyRate';
import Inventory from '@/models/Inventory';
import { sendLowStockAlert } from '@/lib/email';
import { fetchLiveRates } from '@/lib/exchangeRates';

export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  const results = { currency: null, inventory: null };

  // 1. Update currency rates — tries openexchangerates.org (if a key is configured), then two
  // independent keyless providers, so this cron job keeps rates fresh even without any API key set.
  try {
    const live = await fetchLiveRates();
    if (live) {
      await CurrencyRate.findOneAndUpdate({}, { rates: live.rates, lastUpdated: new Date(), base: 'USD', source: live.source }, { upsert: true });
      results.currency = `updated via ${live.source}`;
    } else {
      results.currency = 'all providers failed — kept previous cached rate';
    }
  } catch (e) { results.currency = `error: ${e.message}`; }

  // 2. Low stock check + email
  try {
    const lowStock = await Inventory.find({ $expr: { $lte: ['$currentStock', '$minimumStockAlert'] } }).populate('product', 'name unit').lean();
    if (lowStock.length > 0) {
      await sendLowStockAlert(lowStock);
      results.inventory = `${lowStock.length} low stock items alerted`;
    } else {
      results.inventory = 'all ok';
    }
  } catch (e) { results.inventory = `error: ${e.message}`; }

  return NextResponse.json({ success: true, ...results, timestamp: new Date().toISOString() });
}

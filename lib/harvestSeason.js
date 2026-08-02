import Product from '@/models/Product';
import { computeHarvestingSeason } from './utils';

// Issue 4: "Currently Harvesting" must track the current date/time automatically, with no manual
// admin toggle. There's no cron/scheduled-task infrastructure in this project (confirmed — no
// node-cron, no Vercel cron config, nothing), so instead of relying on a periodic job that might not
// actually run in every hosting environment, correctness is self-healed from real request traffic:
//
//   - syncHarvestingSeasonStatus() does a cheap bulk correction (two indexed updateMany calls, both
//     true no-ops once the DB is already in sync) and is called from the site's highest-traffic
//     product-list entry points (the main /api/products listing and the homepage). In practice this
//     means the stored field self-corrects within moments of a month boundary passing, without
//     needing any external scheduler.
//   - applyComputedHarvestSeason() handles the single-document case (e.g. a direct link to one
//     product landing before any list endpoint has run the bulk sync since a boundary passed) — it
//     corrects the in-memory object immediately (so THIS response is right regardless of DB state)
//     and fires a non-blocking write to catch the DB up too.
//
// Both are no-ops for any product with no harvestingMonths configured (computeHarvestingSeason
// returns null in that case) — those legacy/unconfigured products keep whatever isHarvestingSeason
// value they already have, exactly as before this feature existed.

export async function syncHarvestingSeasonStatus() {
  const currentMonth = new Date().getMonth() + 1;
  await Promise.all([
    Product.updateMany(
      { harvestingMonths: currentMonth, isHarvestingSeason: { $ne: true } },
      { $set: { isHarvestingSeason: true } }
    ),
    Product.updateMany(
      { harvestingMonths: { $exists: true, $ne: [], $nin: [currentMonth] }, isHarvestingSeason: { $ne: false } },
      { $set: { isHarvestingSeason: false } }
    ),
  ]);
}

export function applyComputedHarvestSeason(product) {
  if (!product) return product;
  const computed = computeHarvestingSeason(product.harvestingMonths);
  if (computed !== null && computed !== product.isHarvestingSeason) {
    product.isHarvestingSeason = computed;
    Product.updateOne({ _id: product._id }, { $set: { isHarvestingSeason: computed } }).catch(() => {});
  }
  return product;
}

// Same idea, applied to every product in an array (e.g. a populated list) in one pass.
export function applyComputedHarvestSeasonToAll(products) {
  if (!Array.isArray(products)) return products;
  products.forEach(applyComputedHarvestSeason);
  return products;
}

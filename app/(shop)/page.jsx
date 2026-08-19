import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import Banner from '@/models/Banner';
import FlashSale from '@/models/FlashSale';
import SpecialSection from '@/models/SpecialSection';
import HomeClientWrapper from './HomeClientWrapper';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncHarvestingSeasonStatus } from '@/lib/harvestSeason';

// Categories, campaigns, featured products, and sections are all
// admin-managed and should reflect the moment they're changed — ISR's
// 60-second revalidation window meant changes could take up to a minute
// to appear, which is what "every change from admin panel should be
// implemented instantly" was catching.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getHomeData() {
  await connectDB();
  // Issue 4: keep isHarvestingSeason accurate for "today" before the season-dependent queries
  // below (Currently Harvesting / Available for Pre-Order both key off it) run.
  await syncHarvestingSeasonStatus();
  const now = new Date();
  const session = await getServerSession(authOptions);

  // Issue 11: campaigns/sections can be restricted to one buyer type via targetAudience — known
  // server-side only for a signed-in buyer (guests fall back to the client-side filter in
  // HomeClientWrapper.jsx, same reasoning as buyerVisibilityQuery just below).
  const campaignAudienceQuery = session?.user?.buyerType === 'local' ? { targetAudience: { $in: ['all', 'local'] } }
    : session?.user?.buyerType === 'international' ? { targetAudience: { $in: ['all', 'international'] } }
    : {};
  const buyerVisibilityQuery = session?.user?.buyerType === 'local' ? { availableForLocal: { $ne: false } }
    : session?.user?.buyerType === 'international' ? { availableForInternational: { $ne: false } }
    : {};

  const [categories, allCategories, flashSales, sections, heroBanners, promoBanners, popupBanners] = await Promise.all([
    Category.find({ isActive: true }).sort({ displayOrder: 1 }).limit(8).lean(),
    // Uncapped — issue 13 wants EVERY category represented as its own section below, not just the
    // top 8 shown as browse tiles.
    Category.find({ isActive: true }).sort({ displayOrder: 1 }).lean(),
    // ALL active campaigns within their time window — not just one.
    // Previously this used FlashSale.findOne() (singular), which is why
    // only a single campaign could ever appear on the homepage even when
    // several were active and scheduled at once.
    // isActive uses $ne:false, not ===true — see lib/utils.js's buildProductQuery for the same
    // reasoning: a campaign missing the field entirely (predates it, or was inserted outside the
    // normal create flow) must still be findable, not silently excluded from ever appearing.
    // select must include priceRangeMin/priceRangeMax (international USD range) — without them,
    // getEffectivePricing() in lib/utils.js sees `product.priceRangeMin/Max` as undefined and
    // computes both as 0, which is exactly why international buyers were seeing a $0 campaign
    // price: this populate silently stripped the very fields that price is built from before
    // PriceDisplay ever got a chance to render them. Kept in sync with the SpecialSection populate
    // 4 lines below, which already selected them correctly.
    FlashSale.find({ isActive: { $ne: false }, startTime: { $lte: now }, endTime: { $gte: now }, ...campaignAudienceQuery })
      .populate({ path: 'items.product', select: 'name localName images slug price discountPrice priceRangeMin priceRangeMax unit isHarvestingSeason availableForLocal availableForInternational', match: buyerVisibilityQuery })
      .sort({ createdAt: -1 })
      .lean(),
    SpecialSection.find({ isActive: true, position: { $in: ['home', 'both'] }, ...campaignAudienceQuery })
      .populate({ path: 'products', select: 'name localName images slug price discountPrice priceRangeMin priceRangeMax unit isHarvestingSeason isFeatured availableForLocal availableForInternational', match: buyerVisibilityQuery })
      .sort('displayOrder')
      .limit(5)
      .lean(),
    Banner.find({ isActive: true, type: 'hero' }).sort({ displayOrder: 1 }).lean(),
    // Batch 18 (R32): promotional + side banners render identically (see PromoBannerStrip's own
    // comment for why) — one query covers both types. position 'all' banners are included on every
    // page, same reasoning as 'home' ones.
    Banner.find({ isActive: true, type: { $in: ['promotional', 'side'] }, position: { $in: ['home', 'all'] } }).sort({ displayOrder: 1 }).lean(),
    Banner.find({ isActive: true, type: 'popup', position: { $in: ['home', 'all'] } }).sort({ displayOrder: 1 }).lean(),
  ]);

  // Issue 13: a single, page-wide "already shown" set so no product repeats anywhere on the
  // homepage — including between campaigns and special sections themselves, which are fetched in
  // parallel above and so can't natively see each other's picks; campaigns (the more
  // time-sensitive of the two) take priority, and a special section silently drops anything a
  // campaign already claimed. The algorithmic sections further below then simply skip whatever's
  // already spoken for, in the priority order the issue lists them: Currently Harvesting, then
  // Available for Pre-Order, then one section per category. Sequential (not Promise.all) from here
  // on since each step's exclusion set depends on the previous ones.
  const excludeIds = new Set();
  flashSales.forEach(sale => (sale.items || []).forEach(i => i.product && excludeIds.add(String(i.product._id))));
  sections.forEach(s => { s.products = (s.products || []).filter(p => p && !excludeIds.has(String(p._id))); });
  sections.forEach(s => (s.products || []).forEach(p => excludeIds.add(String(p._id))));

  const featuredProducts = await Product.find({ isFeatured: true, isActive: true, _id: { $nin: [...excludeIds] }, ...buyerVisibilityQuery })
    .populate('category', 'name slug')
    .sort({ isHarvestingSeason: -1, createdAt: -1 })
    .limit(12)
    .lean();
  featuredProducts.forEach(p => excludeIds.add(String(p._id)));

  // 1. Currently Harvesting — everything in season right now.
  const harvestingProducts = await Product.find({ isActive: true, isHarvestingSeason: true, _id: { $nin: [...excludeIds] }, ...buyerVisibilityQuery })
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .limit(16)
    .lean();
  harvestingProducts.forEach(p => excludeIds.add(String(p._id)));

  // 2. Available for Pre-Order — off-season products still orderable ahead of harvest. Matches
  // the existing product-detail-page badge logic (⏰ Pre-Order shown exactly when NOT harvesting).
  const preOrderProducts = await Product.find({ isActive: true, allowPreOrder: true, isHarvestingSeason: false, _id: { $nin: [...excludeIds] }, ...buyerVisibilityQuery })
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .limit(16)
    .lean();
  preOrderProducts.forEach(p => excludeIds.add(String(p._id)));

  // 3. One section per category, in category displayOrder — whatever's left in each, after 1 & 2
  // and each other have taken their share. Categories with nothing left are simply omitted.
  const categorySections = [];
  for (const cat of allCategories) {
    const products = await Product.find({ isActive: true, category: cat._id, _id: { $nin: [...excludeIds] }, ...buyerVisibilityQuery })
      .sort({ isHarvestingSeason: -1, createdAt: -1 })
      .limit(12)
      .lean();
    if (products.length === 0) continue;
    products.forEach(p => excludeIds.add(String(p._id)));
    categorySections.push({ category: cat, products });
  }

  return { categories, featuredProducts, flashSales, sections, heroBanners, promoBanners, popupBanners, harvestingProducts, preOrderProducts, categorySections };
}

export default async function HomePage() {
  const data = await getHomeData();
  const serialized = JSON.parse(JSON.stringify(data));
  return <HomeClientWrapper {...serialized} />;
}

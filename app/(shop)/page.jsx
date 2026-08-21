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

  // Batch 20 (issue 2): a single "already claimed" set so no product repeats anywhere on the
  // homepage — but ONLY fed by FlashSale campaigns and SpecialSections, the literal admin-curated
  // "campaign or section" a product can be deliberately assigned to (per this batch's own wording:
  // "if any product is selected for any campaign or section, the product will be displayed on the
  // campaign or section"). Campaigns (more time-sensitive) take priority; a special section silently
  // drops anything a campaign already claimed.
  //
  // Featured, Currently Harvesting, Available for Pre-Order, and the per-category sections below are
  // all algorithmic/dynamic groupings, not something a product is "selected for" — a product CAN
  // legitimately land in more than one of these at once, the same way a real e-commerce site shows
  // the same item under Best Sellers AND its own category page. Previously these ALSO excluded each
  // other in a growing chain, which is what caused a category like Fresh Fruits (heavily represented
  // in Currently Harvesting during its own season) to be left showing almost nothing in its own
  // "Shop the Category" section — Harvesting had already claimed most of its products first. They now
  // all filter against the SAME static campaignsAndSectionsExclude list instead of chaining off each
  // other, which is also why they can safely run in parallel below (none of them depend on another's
  // results any more).
  const campaignsAndSectionsExcludeIds = new Set();
  flashSales.forEach(sale => (sale.items || []).forEach(i => i.product && campaignsAndSectionsExcludeIds.add(String(i.product._id))));
  sections.forEach(s => { s.products = (s.products || []).filter(p => p && !campaignsAndSectionsExcludeIds.has(String(p._id))); });
  sections.forEach(s => (s.products || []).forEach(p => campaignsAndSectionsExcludeIds.add(String(p._id))));
  const campaignsAndSectionsExclude = [...campaignsAndSectionsExcludeIds];

  const [featuredProducts, harvestingProducts, preOrderProducts, categorySectionsRaw] = await Promise.all([
    Product.find({ isFeatured: true, isActive: true, _id: { $nin: campaignsAndSectionsExclude }, ...buyerVisibilityQuery })
      .populate('category', 'name slug')
      .sort({ isHarvestingSeason: -1, createdAt: -1 })
      .limit(12)
      .lean(),
    // 1. Currently Harvesting — everything in season right now.
    Product.find({ isActive: true, isHarvestingSeason: true, _id: { $nin: campaignsAndSectionsExclude }, ...buyerVisibilityQuery })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(16)
      .lean(),
    // 2. Available for Pre-Order — off-season products still orderable ahead of harvest. Matches
    // the existing product-detail-page badge logic (⏰ Pre-Order shown exactly when NOT harvesting).
    Product.find({ isActive: true, allowPreOrder: true, isHarvestingSeason: false, _id: { $nin: campaignsAndSectionsExclude }, ...buyerVisibilityQuery })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(16)
      .lean(),
    // 3. One section per category, in category displayOrder — categories with nothing left (after
    // only campaigns/sections have taken their share) are simply omitted.
    Promise.all(allCategories.map(cat =>
      Product.find({ isActive: true, category: cat._id, _id: { $nin: campaignsAndSectionsExclude }, ...buyerVisibilityQuery })
        .sort({ isHarvestingSeason: -1, createdAt: -1 })
        .limit(12)
        .lean()
        .then(products => ({ category: cat, products }))
    )),
  ]);
  const categorySections = categorySectionsRaw.filter(cs => cs.products.length > 0);

  return { categories, featuredProducts, flashSales, sections, heroBanners, promoBanners, popupBanners, harvestingProducts, preOrderProducts, categorySections };
}

export default async function HomePage() {
  const data = await getHomeData();
  const serialized = JSON.parse(JSON.stringify(data));
  return <HomeClientWrapper {...serialized} />;
}

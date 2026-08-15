import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import SpecialSection from '@/models/SpecialSection';
import FlashSale from '@/models/FlashSale';
import Order from '@/models/Order';
// Batch 17 (R9): required by the .populate('category', ...) call below — every file that calls
// .populate() on a Mongoose ref must import the target model directly in that same file, or
// MissingSchemaError throws on a fresh serverless cold start (mongoose's model registry is
// per-process, not centrally seeded by lib/mongodb.js's connectDB()). See PROJECT_STATUS.md for
// the fuller history of this bug class — this sweep (batch 17) extends the same fix already
// applied to app/api/export/* in an earlier batch to the rest of the app.
import Category from '@/models/Category';
import ProductDetailClient from './ProductDetailClient';
import { applyComputedHarvestSeason } from '@/lib/harvestSeason';

const CARD_FIELDS = 'name images slug price discountPrice priceRangeMin priceRangeMax unit isHarvestingSeason category isOrganic isFeatured availableForLocal availableForInternational';

export async function generateMetadata({ params }) {
  await connectDB();
  const product = await Product.findOne({ slug: params.slug }).lean();
  if (!product) return { title: 'Product Not Found' };
  return { title: product.name, description: product.shortDescription || product.description?.slice(0, 160) };
}

// Product detail page sections & de-dup rule (issues 31 + 32). Rendered top-to-bottom:
//   1. Campaigns (SpecialSections targeting this page) — shown as-is. The SAME product CAN appear in
//      more than one campaign here (each carries its own badge/discount/metrics, so a repeat is
//      meaningful, not a duplicate) — campaigns do not exclude each other.
//   2. Active flash-sale campaigns strip — excludes anything already used by campaigns above.
//   3. Related products (same category) — excludes everything above.
//   4. Recommended for you (order-history based, falls back to same-category) — excludes everything
//      above. Mirrors /api/products/recommended's logic so both stay consistent.
//   5. Best selling products (real delivered-order aggregation) — excludes everything above. Mirrors
//      /api/products/best-selling's logic.
// Every section after #1 excludes every product ID already used by an earlier section, computed
// server-side in one pass so the exclusion is guaranteed correct (no client-side race between
// independently-fetching components, which is what allowed duplicates before).
export default async function ProductPage({ params }) {
  await connectDB();
  const product = await Product.findOne({ slug: params.slug, isActive: true }).populate('category', 'name slug').lean();
  if (!product) notFound();
  applyComputedHarvestSeason(product);

  const session = await getServerSession(authOptions);
  const excludeIds = new Set([String(product._id)]);
  // Issue 9: for a signed-in buyer we KNOW their buyerType server-side (guests only have it in
  // localStorage, which the server can't read — that case still relies on the client-side filter in
  // ProductDetailClient.jsx). Applying it directly in the query means an invisible-to-this-buyer
  // product never occupies a dedup slot in the first place, instead of being fetched, excluded, and
  // silently leaving that section one item short.
  const buyerVisibilityQuery = session?.user?.buyerType === 'local' ? { availableForLocal: { $ne: false } }
    : session?.user?.buyerType === 'international' ? { availableForInternational: { $ne: false } }
    : {};

  // Issue 11: campaigns/sections can be restricted to one buyer type via their OWN targetAudience
  // field (separate from per-product availability, which buyerVisibilityQuery above already
  // scopes). Known server-side only for a signed-in buyer; guests fall back to the client-side
  // isCampaignVisibleToBuyer filter in ProductDetailClient.jsx, same reasoning as buyerVisibilityQuery.
  const campaignAudienceQuery = session?.user?.buyerType === 'local' ? { targetAudience: { $in: ['all', 'local'] } }
    : session?.user?.buyerType === 'international' ? { targetAudience: { $in: ['all', 'international'] } }
    : {};

  // 1. Campaigns targeting the product-detail page
  const sectionsRaw = await SpecialSection.find({ isActive: true, position: { $in: ['productDetail', 'both'] }, ...campaignAudienceQuery })
    .populate({ path: 'products', select: CARD_FIELDS, match: buyerVisibilityQuery })
    .sort('displayOrder')
    .limit(6)
    .lean();
  // populate's `match` leaves a null in place of any filtered-out product rather than removing the
  // array slot, so an explicit compact is still needed here.
  for (const s of sectionsRaw) s.products = (s.products || []).filter(Boolean);
  const sections = sectionsRaw.filter(s => s.products?.length);
  for (const s of sections) for (const p of s.products) excludeIds.add(String(p._id));

  // 2. Active flash-sale campaigns (the banner strip) — re-filter each sale's items against what
  // campaigns above already used, and claim whichever product ends up displayed (the first remaining
  // item) so it can't ALSO turn up in Related/Recommended/Best-Selling further down the page.
  const now = new Date();
  // isActive uses $ne:false, not ===true — see app/(shop)/page.jsx's identical query for the reasoning.
  // select reuses CARD_FIELDS (not a hand-rolled subset) so it can never again silently drop a field
  // PriceDisplay/getEffectivePricing needs — that's exactly how this used to omit price/discountPrice/
  // priceRangeMin/priceRangeMax/images entirely and make every campaign product on this page show a
  // $0/৳0 price with no photo.
  const activeSalesRaw = await FlashSale.find({ isActive: { $ne: false }, startTime: { $lte: now }, endTime: { $gte: now }, ...campaignAudienceQuery })
    .populate({ path: 'items.product', select: CARD_FIELDS, match: buyerVisibilityQuery })
    .limit(6)
    .lean();
  const activeCampaigns = [];
  for (const sale of activeSalesRaw) {
    const remainingItems = (sale.items || []).filter(i => i.product && !excludeIds.has(String(i.product._id)));
    if (remainingItems.length === 0) continue;
    activeCampaigns.push({ ...sale, items: remainingItems });
    excludeIds.add(String(remainingItems[0].product._id));
    if (activeCampaigns.length >= 3) break;
  }

  // 3. Related products (same category)
  let relatedProducts = [];
  if (product.category?._id) {
    relatedProducts = await Product.find({ isActive: true, category: product.category._id, _id: { $nin: [...excludeIds] }, ...buyerVisibilityQuery })
      .populate('category', 'name slug').limit(8).lean();
    for (const p of relatedProducts) excludeIds.add(String(p._id));
  }

  // 4. Recommended for you — mirrors /api/products/recommended
  let recommendedCategoryIds = [];
  if (session?.user?.id) {
    try {
      const pastOrders = await Order.find({ user: session.user.id, status: { $ne: 'cancelled' } })
        .select('items.product').populate('items.product', 'category').lean();
      const seen = new Set();
      pastOrders.forEach(o => (o.items || []).forEach(i => { if (i.product?.category) seen.add(String(i.product.category)); }));
      recommendedCategoryIds = [...seen];
    } catch { recommendedCategoryIds = []; }
  }
  if (recommendedCategoryIds.length === 0 && product.category?._id) recommendedCategoryIds = [String(product.category._id)];
  const personalized = recommendedCategoryIds.length > 0 && !!session?.user?.id && recommendedCategoryIds[0] !== String(product.category?._id || '');

  let recommendedProducts = await Product.find({
    isActive: true, _id: { $nin: [...excludeIds] }, ...buyerVisibilityQuery,
    ...(recommendedCategoryIds.length ? { category: { $in: recommendedCategoryIds } } : {}),
  }).populate('category', 'name slug').sort({ isHarvestingSeason: -1, isFeatured: -1, createdAt: -1 }).limit(8).lean();
  if (recommendedProducts.length < 8) {
    const more = await Product.find({
      isActive: true, isFeatured: true, ...buyerVisibilityQuery,
      _id: { $nin: [...excludeIds, ...recommendedProducts.map(p => String(p._id))] },
    }).populate('category', 'name slug').limit(8 - recommendedProducts.length).lean();
    recommendedProducts = [...recommendedProducts, ...more];
  }
  for (const p of recommendedProducts) excludeIds.add(String(p._id));

  // 5. Best selling products — mirrors /api/products/best-selling
  let bestSellingProducts = [];
  try {
    const topSellerAgg = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', sold: { $sum: '$items.quantity' } } },
      { $sort: { sold: -1 } },
      { $limit: 30 },
    ]);
    const bestSellerIds = topSellerAgg.map(t => String(t._id)).filter(id => !excludeIds.has(id));
    if (bestSellerIds.length) {
      const found = await Product.find({ _id: { $in: bestSellerIds }, isActive: true, ...buyerVisibilityQuery }).populate('category', 'name slug').lean();
      const bySold = new Map(topSellerAgg.map(t => [String(t._id), t.sold]));
      bestSellingProducts = found
        .sort((a, b) => (bySold.get(String(b._id)) || 0) - (bySold.get(String(a._id)) || 0))
        .slice(0, 8)
        .map(p => ({ ...p, unitsSold: bySold.get(String(p._id)) || 0 }));
    }
  } catch {
    bestSellingProducts = [];
  }

  return (
    <ProductDetailClient
      product={JSON.parse(JSON.stringify(product))}
      sections={JSON.parse(JSON.stringify(sections))}
      activeCampaigns={JSON.parse(JSON.stringify(activeCampaigns))}
      relatedProducts={JSON.parse(JSON.stringify(relatedProducts))}
      recommendedProducts={JSON.parse(JSON.stringify(recommendedProducts))}
      recommendedPersonalized={personalized}
      bestSellingProducts={JSON.parse(JSON.stringify(bestSellingProducts))}
    />
  );
}

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
  // Batch 20 (issue 3): prefer the admin's own metaTitle/metaDescription when set (Product already
  // has these fields — they just weren't read anywhere before this), and add the openGraph/twitter
  // image tags this page was missing entirely, so sharing a product link (WhatsApp, Facebook, etc.)
  // actually shows a preview photo instead of nothing.
  const title = product.metaTitle || product.name;
  const description = product.metaDescription || product.shortDescription || product.description?.slice(0, 160);
  const image = product.images?.[0];
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', ...(image && { images: [image] }) },
    twitter: { card: 'summary_large_image', title, description, ...(image && { images: [image] }) },
  };
}

// Product detail page sections & de-dup rule (batch 20, issue 2 — supersedes the older "excludes
// everything above" chain this comment used to describe for sections 3–5). Rendered top-to-bottom:
//   1. Campaigns (SpecialSections targeting this page) — shown as-is. The SAME product CAN appear in
//      more than one campaign here (each carries its own badge/discount/metrics, so a repeat is
//      meaningful, not a duplicate) — campaigns do not exclude each other.
//   2. Active flash-sale campaigns strip — excludes anything already used by campaigns above.
//   3. Related products (same category) — excludes only #1+#2 above (the current product's own
//      admin-curated campaigns/sections), NOT #4 or #5 below.
//   4. Recommended for you (order-history based, falls back to same-category) — same: excludes only
//      #1+#2, not #3 or #5. Mirrors /api/products/recommended's logic so both stay consistent.
//   5. Best selling products (real delivered-order aggregation) — same: excludes only #1+#2, not #3
//      or #4. Mirrors /api/products/best-selling's logic.
// #1/#2 are the literal admin-curated "campaign or section" a product can be deliberately assigned
// to, so they keep first claim over everything below and exclude each other in that priority order.
// #3/#4/#5 are algorithmic/dynamic groupings instead (nobody "selected" a product for Best Selling —
// it just sold well) — a product CAN legitimately turn up in more than one of them at once, same as
// any real e-commerce site showing the same item as both "related" and a "best seller". They used to
// ALSO exclude each other in a growing chain, which is what could starve a section down to almost
// nothing whenever an earlier one happened to claim most of what was available — computed as
// independent, parallel queries now instead.
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

  // Batch 20 (issue 2): everything from here down (Related/Recommended/Best-Selling) is an
  // algorithmic/dynamic grouping, not something a product is "selected for" the way the campaigns/
  // sections above are — a product CAN legitimately be both genuinely "related" by category AND a
  // genuine best-seller at the same time, the same way it could on any real e-commerce site. They now
  // all filter against this ONE static snapshot (the current product itself + whatever campaigns/
  // sections above already claimed) instead of excluding each other in a growing chain, which is what
  // previously starved these sections down to almost nothing whenever an earlier one happened to claim
  // most of what was available. Independent of each other now, so they also run in parallel.
  const group1ExcludeIds = excludeIds;
  const group1Exclude = [...group1ExcludeIds];

  // 3. Related products (same category)
  const relatedPromise = product.category?._id
    ? Product.find({ isActive: true, category: product.category._id, _id: { $nin: group1Exclude }, ...buyerVisibilityQuery })
        .populate('category', 'name slug').limit(8).lean()
    : Promise.resolve([]);

  // 4. Recommended for you — mirrors /api/products/recommended
  const recommendedPromise = (async () => {
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
    const isPersonalized = recommendedCategoryIds.length > 0 && !!session?.user?.id && recommendedCategoryIds[0] !== String(product.category?._id || '');

    let products = await Product.find({
      isActive: true, _id: { $nin: group1Exclude }, ...buyerVisibilityQuery,
      ...(recommendedCategoryIds.length ? { category: { $in: recommendedCategoryIds } } : {}),
    }).populate('category', 'name slug').sort({ isHarvestingSeason: -1, isFeatured: -1, createdAt: -1 }).limit(8).lean();
    if (products.length < 8) {
      const more = await Product.find({
        isActive: true, isFeatured: true, ...buyerVisibilityQuery,
        _id: { $nin: [...group1Exclude, ...products.map(p => String(p._id))] },
      }).populate('category', 'name slug').limit(8 - products.length).lean();
      products = [...products, ...more];
    }
    return { products, isPersonalized };
  })();

  // 5. Best selling products — mirrors /api/products/best-selling
  const bestSellingPromise = (async () => {
    try {
      const topSellerAgg = await Order.aggregate([
        { $match: { status: 'delivered' } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', sold: { $sum: '$items.quantity' } } },
        { $sort: { sold: -1 } },
        { $limit: 30 },
      ]);
      const bestSellerIds = topSellerAgg.map(t => String(t._id)).filter(id => !group1ExcludeIds.has(id));
      if (!bestSellerIds.length) return [];
      const found = await Product.find({ _id: { $in: bestSellerIds }, isActive: true, ...buyerVisibilityQuery }).populate('category', 'name slug').lean();
      const bySold = new Map(topSellerAgg.map(t => [String(t._id), t.sold]));
      return found
        .sort((a, b) => (bySold.get(String(b._id)) || 0) - (bySold.get(String(a._id)) || 0))
        .slice(0, 8)
        .map(p => ({ ...p, unitsSold: bySold.get(String(p._id)) || 0 }));
    } catch {
      return [];
    }
  })();

  const [relatedProducts, recommendedResult, bestSellingProducts] = await Promise.all([relatedPromise, recommendedPromise, bestSellingPromise]);
  const recommendedProducts = recommendedResult.products;
  const personalized = recommendedResult.isPersonalized;

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

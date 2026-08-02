'use client';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { isProductVisibleToBuyer, isCampaignVisibleToBuyer } from '@/lib/utils';
import HeroSection from '@/components/home/HeroSection';
import CategorySection from '@/components/home/CategorySection';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import ProductCarouselSection from '@/components/home/ProductCarouselSection';
import FlashSaleSection from '@/components/home/FlashSaleSection';
import SpecialSectionComp from '@/components/home/SpecialSection';
import HowItWorks from '@/components/home/HowItWorks';
import Testimonials from '@/components/home/Testimonials';
import CertificationsSection from '@/components/home/CertificationsSection';
import PartnersSection from '@/components/home/PartnersSection';
import FAQSection from '@/components/home/FAQSection';

/**
 * Interleaves multiple active campaigns between the other homepage sections
 * so two campaigns never render back-to-back — per spec, campaigns should
 * appear separated by 1–4 other sections/rows depending on how many
 * campaigns are active, rather than stacked directly on top of each other.
 *
 * Also strips out any product not available to the current buyerType before
 * anything renders — this is the actual buyer-visibility enforcement point
 * for the homepage, since featured/campaign/section products are fetched
 * server-side (which can't know a guest's localStorage-only buyerType) and
 * were previously never filtered at all.
 *
 * Issue 13: the server already guarantees no product repeats anywhere on the
 * page (a single exclude-set threaded through every query in page.jsx) — the
 * client-side buyerType filtering below can only ever REMOVE items from a
 * list, never add one somewhere else, so that guarantee holds no matter what
 * a guest's buyerType turns out to be once it's known client-side.
 */
function buildHomeSections({ categories, featuredProducts, flashSales, sections, harvestingProducts, preOrderProducts, categorySections, isLocal, buyerType }) {
  const visibleFeatured = featuredProducts.filter(p => isProductVisibleToBuyer(p, buyerType));
  const visibleHarvesting = (harvestingProducts || []).filter(p => isProductVisibleToBuyer(p, buyerType));
  const visiblePreOrder = (preOrderProducts || []).filter(p => isProductVisibleToBuyer(p, buyerType));
  const visibleCategorySections = (categorySections || [])
    .map(cs => ({ ...cs, products: (cs.products || []).filter(p => isProductVisibleToBuyer(p, buyerType)) }))
    .filter(cs => cs.products.length > 0);

  const visibleFlashSales = flashSales
    .filter(sale => isCampaignVisibleToBuyer(sale, buyerType))
    .map(sale => ({
      ...sale,
      items: (sale.items || []).filter(item => item.product && isProductVisibleToBuyer(item.product, buyerType)),
    }))
    .filter(sale => sale.items.length > 0); // drop a campaign entirely if none of its products apply to this buyer

  const visibleSections = sections
    .filter(s => isCampaignVisibleToBuyer(s, buyerType))
    .map(s => ({ ...s, products: (s.products || []).filter(p => isProductVisibleToBuyer(p, buyerType)) }))
    .filter(s => s.products.length > 0);

  const blocks = [
    { key: 'categories', node: <CategorySection categories={categories} /> },
    // Issue 13, in the order specified: Currently Harvesting, then Available for Pre-Order, then
    // one section per category (further down, after Featured/Special Sections).
    ...(visibleHarvesting.length > 0 ? [{
      key: 'harvesting',
      node: <ProductCarouselSection eyebrow="In Season Now" title="🌾 Currently Harvesting" subtitle="Fresh off the farm and ready to ship today" products={visibleHarvesting} viewAllHref="/products?harvesting=true" />,
    }] : []),
    ...(visiblePreOrder.length > 0 ? [{
      key: 'preorder',
      node: <ProductCarouselSection eyebrow="Reserve Ahead" title="⏰ Available for Pre-Order" subtitle="Order now, harvested and shipped when ready" products={visiblePreOrder} viewAllHref="/products?preOrder=true" />,
    }] : []),
    { key: 'featured', node: <FeaturedProducts products={visibleFeatured} /> },
    ...visibleSections.map(s => ({ key: `special-${s._id}`, node: <SpecialSectionComp section={s} /> })),
    ...visibleCategorySections.map(cs => ({
      key: `category-${cs.category._id}`,
      node: (
        <ProductCarouselSection
          eyebrow="Shop the Category"
          title={cs.category.name}
          subtitle={`Explore our full ${cs.category.name.toLowerCase()} selection`}
          products={cs.products}
          viewAllHref={`/categories/${cs.category.slug}`}
        />
      ),
    })),
    { key: 'how-it-works', node: <HowItWorks isLocal={isLocal} /> },
  ];

  if (visibleFlashSales.length === 0) return blocks;

  // Spread campaigns roughly evenly across the other blocks so each one is
  // separated by at least one non-campaign section.
  const gap = Math.max(1, Math.floor(blocks.length / (visibleFlashSales.length + 1)));
  const result = [];
  let campaignIdx = 0;
  blocks.forEach((block, i) => {
    result.push(block);
    const isGapPoint = (i + 1) % gap === 0;
    if (isGapPoint && campaignIdx < visibleFlashSales.length) {
      const sale = visibleFlashSales[campaignIdx];
      result.push({ key: `campaign-${sale._id}`, node: <FlashSaleSection sale={sale} /> });
      campaignIdx++;
    }
  });
  // Any remaining campaigns (more campaigns than gap points) go at the end,
  // still each separated from the next by nothing else — but this only
  // happens with an unusually large number of simultaneous campaigns.
  while (campaignIdx < visibleFlashSales.length) {
    const sale = visibleFlashSales[campaignIdx];
    result.push({ key: `campaign-${sale._id}`, node: <FlashSaleSection sale={sale} /> });
    campaignIdx++;
  }
  return result;
}

export default function HomeClientWrapper({ categories, featuredProducts, flashSales, sections, heroBanners, harvestingProducts, preOrderProducts, categorySections }) {
  const { isLocal, buyerType } = useBuyerType();
  const homeSections = buildHomeSections({
    categories, featuredProducts, flashSales: flashSales || [], sections,
    harvestingProducts, preOrderProducts, categorySections,
    isLocal, buyerType,
  });

  return (
    <>
      <HeroSection banners={heroBanners} />
      {homeSections.map(b => <div key={b.key}>{b.node}</div>)}
      <CertificationsSection />
      <PartnersSection />
      <FAQSection />
      <Testimonials />
    </>
  );
}

import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import Banner from '@/models/Banner';
import FlashSale from '@/models/FlashSale';
import SpecialSection from '@/models/SpecialSection';
import HomeClientWrapper from './HomeClientWrapper';

// Categories, campaigns, featured products, and sections are all
// admin-managed and should reflect the moment they're changed — ISR's
// 60-second revalidation window meant changes could take up to a minute
// to appear, which is what "every change from admin panel should be
// implemented instantly" was catching.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getHomeData() {
  await connectDB();
  const now = new Date();
  const [categories, featuredProducts, flashSales, sections, heroBanners] = await Promise.all([
    Category.find({ isActive: true }).sort({ displayOrder: 1 }).limit(8).lean(),
    // In-season products prioritized first (products page & homepage both
    // sort seasonal-first), then by recency.
    Product.find({ isFeatured: true, isActive: true })
      .populate('category', 'name slug')
      .sort({ isHarvestingSeason: -1, createdAt: -1 })
      .limit(12)
      .lean(),
    // ALL active campaigns within their time window — not just one.
    // Previously this used FlashSale.findOne() (singular), which is why
    // only a single campaign could ever appear on the homepage even when
    // several were active and scheduled at once.
    FlashSale.find({ isActive: true, startTime: { $lte: now }, endTime: { $gte: now } })
      .populate('items.product', 'name images slug price discountPrice unit isHarvestingSeason')
      .sort({ createdAt: -1 })
      .lean(),
    SpecialSection.find({ isActive: true, position: { $in: ['home', 'both'] } })
      .populate('products', 'name images slug price discountPrice priceRangeMin priceRangeMax unit isHarvestingSeason isFeatured')
      .sort('displayOrder')
      .limit(5)
      .lean(),
    Banner.find({ isActive: true, type: 'hero' }).sort({ displayOrder: 1 }).lean(),
  ]);
  return { categories, featuredProducts, flashSales, sections, heroBanners };
}

export default async function HomePage() {
  const { categories, featuredProducts, flashSales, sections, heroBanners } = await getHomeData();
  const serialized = {
    categories: JSON.parse(JSON.stringify(categories)),
    featuredProducts: JSON.parse(JSON.stringify(featuredProducts)),
    flashSales: JSON.parse(JSON.stringify(flashSales)),
    sections: JSON.parse(JSON.stringify(sections)),
    heroBanners: JSON.parse(JSON.stringify(heroBanners)),
  };
  return <HomeClientWrapper {...serialized} />;
}

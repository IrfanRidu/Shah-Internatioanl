import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import Page from '@/models/Page';

const SITE_URL = process.env.NEXTAUTH_URL || 'https://shahinternational.com';

// Next.js App Router convention: a sitemap.js file at the app root
// auto-generates /sitemap.xml — no manual route needed.
export default async function sitemap() {
  let products = [];
  let categories = [];
  let pages = [];

  try {
    await connectDB();
    [products, categories, pages] = await Promise.all([
      Product.find({ isActive: true }).select('slug updatedAt').limit(2000).lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean(),
      Page.find({ isActive: true }).select('slug updatedAt').lean(),
    ]);
  } catch {
    // If the DB is unreachable at build time, fall back to static routes only
  }

  const staticRoutes = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy-policy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/refund-policy`, changeFrequency: 'yearly', priority: 0.3 },
  ].map(r => ({ ...r, lastModified: new Date() }));

  const productRoutes = products.map(p => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: p.updatedAt || new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const categoryRoutes = categories.map(c => ({
    url: `${SITE_URL}/categories/${c.slug}`,
    lastModified: c.updatedAt || new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const pageRoutes = pages.map(p => ({
    url: `${SITE_URL}/${p.slug}`,
    lastModified: p.updatedAt || new Date(),
    changeFrequency: 'monthly',
    priority: 0.4,
  }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...pageRoutes];
}

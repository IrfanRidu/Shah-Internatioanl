import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import Product from '@/models/Product';
import { notFound } from 'next/navigation';
import CategoryProductGrid from './CategoryProductGrid';

// Admin-managed content (category image, product list) should reflect
// instantly — no ISR staleness.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  await connectDB();
  const cat = await Category.findOne({ slug: params.slug }).lean();
  if (!cat) return { title: 'Category' };
  // Batch 20 (issue 3): this previously returned only a bare title, ignoring the metaTitle/
  // metaDescription fields the Category schema already has, and never set an openGraph/twitter
  // image — same gap as the product page, fixed the same way here.
  const title = cat.metaTitle || cat.name;
  const description = cat.metaDescription || cat.description;
  const image = cat.image;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', ...(image && { images: [image] }) },
    twitter: { card: 'summary_large_image', title, description, ...(image && { images: [image] }) },
  };
}

export default async function CategoryPage({ params }) {
  await connectDB();
  const category = await Category.findOne({ slug: params.slug, isActive: true }).lean();
  if (!category) notFound();
  // Buyer-type visibility (availableForLocal/availableForInternational) is
  // enforced client-side in CategoryProductGrid, since a guest's buyer type
  // only lives in localStorage and isn't knowable in this server component —
  // all active products in the category are fetched here, then filtered
  // before rendering.
  const products = await Product.find({ category: category._id, isActive: true })
    .sort({ isHarvestingSeason: -1, createdAt: -1 })
    .lean();

  return (
    <CategoryProductGrid
      category={JSON.parse(JSON.stringify(category))}
      products={JSON.parse(JSON.stringify(products))}
    />
  );
}

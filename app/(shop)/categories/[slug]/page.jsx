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
  return { title: cat?.name || 'Category' };
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

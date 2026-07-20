import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export const metadata = { title: 'All Categories' };
// Category images/details are admin-managed and should reflect instantly —
// no ISR caching (was `revalidate = 60`, meaning changes could take up to a
// minute to appear; this page is now always freshly rendered).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CategoriesPage() {
  await connectDB();
  const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1 }).lean();

  const emojiMap = { vegetables: '🥦', fruits: '🍎', 'herbs-spices': '🌿' };
  const colorMap = { vegetables: '#dcfce7', fruits: '#fce7f3', 'herbs-spices': '#fef9c3' };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>All Categories</h1>
        <p className="text-gray-500 text-lg">Explore our full range of farm-fresh produce</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(cat => (
          <div key={cat._id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
            <div className="relative p-8 text-center overflow-hidden" style={{ backgroundColor: colorMap[cat.slug] || '#f0fdf4', minHeight: '140px' }}>
              {cat.image ? (
                <div className="relative w-full h-24 mx-auto">
                  <Image src={cat.image} alt={cat.name} fill className="object-contain" sizes="300px" />
                </div>
              ) : (
                <span className="text-6xl">{emojiMap[cat.slug] || '🌱'}</span>
              )}
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{cat.name}</h2>
              {cat.description && <p className="text-gray-500 text-sm mb-4">{cat.description}</p>}
              {cat.subcategories?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {cat.subcategories.filter(s => s.isActive !== false).map(sub => (
                    <Link key={sub.slug} href={`/products?subcategory=${sub.slug}`} className="flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 pl-1.5 pr-3 py-1 rounded-full hover:bg-brand hover:text-white transition-all">
                      {sub.image && (
                        <span className="relative w-4 h-4 rounded-full overflow-hidden flex-shrink-0 bg-white">
                          <Image src={sub.image} alt={sub.name} fill className="object-cover" sizes="16px" />
                        </span>
                      )}
                      {sub.name}
                    </Link>
                  ))}
                </div>
              )}
              <Link href={`/categories/${cat.slug}`} className="flex items-center gap-2 font-semibold text-sm text-brand hover:gap-3 transition-all">
                View Products <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

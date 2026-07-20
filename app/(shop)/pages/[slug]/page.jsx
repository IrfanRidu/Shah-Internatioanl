import connectDB from '@/lib/mongodb';
import Page from '@/models/Page';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }) {
  await connectDB();
  const page = await Page.findOne({ slug: params.slug, isActive: true }).lean();
  return { title: page?.metaTitle || page?.title || 'Page', description: page?.metaDescription };
}

export default async function DynamicPage({ params }) {
  await connectDB();
  const page = await Page.findOne({ slug: params.slug, isActive: true }).lean();
  if (!page) notFound();
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>{page.title}</h1>
      <div className="prose prose-green dark:prose-invert max-w-none text-gray-600 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: page.content?.replace(/\n/g, '<br/>') || '' }} />
    </div>
  );
}

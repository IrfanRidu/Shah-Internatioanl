'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { ProductForm } from '../new/page';
import Loader from '@/components/ui/Loader';

export default function EditProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products/${id}`).then(r => r.json()).then(d => {
      if (d.product) setProduct({ ...d.product, category: d.product.category?._id || d.product.category });
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="py-20"><Loader /></div>;
  if (!product) return <div className="py-20 text-center text-gray-400">Product not found</div>;
  // ProductForm uses useSearchParams() (for issue 6's returnTo handling) — Next.js requires a
  // Suspense boundary around that, same reasoning as app/admin/products/page.jsx and .../new/page.jsx.
  return (
    <Suspense fallback={<div className="py-20"><Loader /></div>}>
      <ProductForm initialData={product} productId={id} />
    </Suspense>
  );
}

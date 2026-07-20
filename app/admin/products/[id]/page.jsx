'use client';
import { useState, useEffect } from 'react';
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
  return <ProductForm initialData={product} productId={id} />;
}

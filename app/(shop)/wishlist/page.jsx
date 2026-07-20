'use client';
import { useStore } from '@/store/useStore';
import ProductCard from '@/components/product/ProductCard';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function WishlistPage() {
  const { wishlist, toggleWishlist } = useStore();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>My Wishlist</h1>
          <p className="text-gray-500 text-sm mt-1">{wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''}</p>
        </div>
        {wishlist.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => wishlist.forEach(p => toggleWishlist(p))}>Clear All</Button>
        )}
      </div>
      {wishlist.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
            <Heart className="w-10 h-10 text-red-300" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Your wishlist is empty</h2>
          <p className="text-gray-400 mb-6">Save products you love to revisit them later</p>
          <Link href="/products"><Button variant="primary" icon={ShoppingBag}>Browse Products</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {wishlist.map(p => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </div>
  );
}

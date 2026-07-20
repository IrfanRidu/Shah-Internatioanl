'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import Button from '@/components/ui/Button';
import { Trash2, Plus, Minus, ShoppingBag, Tag, ArrowRight, Leaf, LogIn } from 'lucide-react';

export default function CartPage() {
  const { status } = useSession();
  const { items, removeItem, updateQuantity, applyCoupon, removeCoupon, coupon, couponDiscount, subtotal, total, clearCart } = useCart();
  const { format } = useCurrency();
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const DELIVERY_CHARGE = subtotal >= 1000 ? 0 : 60;
  const grandTotal = total + DELIVERY_CHARGE;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    await applyCoupon(couponInput.trim(), subtotal);
    setCouponLoading(false);
  };

  // Issue 48: the cart is stored in localStorage so it can survive across page
  // loads for a signed-in shopper, but that same mechanism meant a signed-out
  // visitor (or the NEXT person on a shared device) could still see and check
  // out with someone else's saved cart contents. Gate the page itself: while
  // the session is still resolving, show a loader (avoids a flash of the
  // login prompt for people who ARE logged in); once resolved, a signed-out
  // visitor sees a login prompt instead of any cart contents.
  if (status === 'loading') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-brand rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-12 h-12 text-gray-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Please log in to view your cart</h1>
        <p className="text-gray-500 mb-8">Sign in to see the items you've added and continue checkout.</p>
        <Link href={`/login?callbackUrl=${encodeURIComponent('/cart')}`}>
          <Button variant="primary" icon={LogIn}>Log In</Button>
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-12 h-12 text-gray-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-8">Explore our fresh seasonal produce and add items to your cart</p>
        <Link href="/products"><Button variant="primary" icon={Leaf}>Browse Products</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>
        Shopping Cart <span className="text-lg font-normal text-gray-400">({items.length} items)</span>
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map(item => (
            <div key={item.productId} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex gap-4">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                <Image src={item.image || 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=200&q=80'} alt={item.name} fill className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/products/${item.slug}`} className="font-semibold text-gray-900 dark:text-white hover:text-brand transition-colors text-sm line-clamp-1">{item.name}</Link>
                    {item.isPreOrder && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-0.5 inline-block">⏰ Pre-Order</span>}
                  </div>
                  <button onClick={() => removeItem(item.productId)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-3 py-1.5 text-sm font-semibold min-w-[36px] text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand">{format(item.price * item.quantity)}</p>
                    <p className="text-xs text-gray-400">{format(item.price)} / {item.unit}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-2">
            <Link href="/products" className="text-sm text-brand hover:underline flex items-center gap-1">← Continue Shopping</Link>
            <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Clear Cart</button>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 h-fit sticky top-20">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Order Summary</h2>
          <div className="space-y-3 mb-5">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium">{format(subtotal)}</span></div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Delivery</span>
              <span className={DELIVERY_CHARGE === 0 ? 'text-green-600 font-medium' : 'font-medium'}>{DELIVERY_CHARGE === 0 ? 'FREE' : format(DELIVERY_CHARGE)}</span>
            </div>
            {couponDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Coupon ({coupon?.code})</span><span>-{format(couponDiscount)}</span></div>}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between font-bold text-lg">
              <span>Total</span><span className="text-brand">{format(grandTotal)}</span>
            </div>
          </div>

          {subtotal < 1000 && <p className="text-xs text-gray-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-4">🚚 Add {format(1000 - subtotal)} more for FREE delivery!</p>}

          {/* Coupon */}
          {!coupon ? (
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Coupon code" value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())} className="input-field pl-9 text-sm py-2.5" />
              </div>
              <Button onClick={handleApplyCoupon} loading={couponLoading} variant="secondary" size="sm">Apply</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 mb-4">
              <span className="text-sm text-green-700 font-medium">✅ {coupon.code} applied!</span>
              <button onClick={removeCoupon} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
          )}

          <Link href="/checkout">
            <Button variant="primary" className="w-full" size="lg">Proceed to Checkout <ArrowRight className="w-4 h-4" /></Button>
          </Link>
          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-400">
            <span>🔒 Secure checkout</span><span>•</span><span>100% Fresh</span>
          </div>
        </div>
      </div>
    </div>
  );
}

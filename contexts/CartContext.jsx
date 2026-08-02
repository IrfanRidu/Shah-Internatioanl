'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext({});

// Safe localStorage read — won't throw on SSR or when localStorage is blocked
function readCart() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('si-cart') || '[]'); } catch { return []; }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);  // start empty — hydrate on mount
  const [coupon, setCoupon] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage once on client mount (avoids SSR mismatch that was emptying the cart)
  useEffect(() => {
    const saved = readCart();
    if (saved.length) setItems(saved);
    setMounted(true);
  }, []);

  // Persist to localStorage whenever items change (after mount)
  useEffect(() => {
    if (mounted) localStorage.setItem('si-cart', JSON.stringify(items));
  }, [items, mounted]);

  // Use a ref to prevent duplicate toast calls from React Strict Mode double-invoking state updaters
  const toastFiredRef = useRef(false);

  const addItem = useCallback((product, quantity = 1, isPreOrder = false) => {
    toastFiredRef.current = false;
    setItems(prev => {
      const existing = prev.find(i => i.productId === product._id);
      if (existing) {
        if (!toastFiredRef.current) {
          toastFiredRef.current = true;
          setTimeout(() => toast.success('Quantity updated'), 0);
        }
        return prev.map(i => i.productId === product._id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      if (!toastFiredRef.current) {
        toastFiredRef.current = true;
        setTimeout(() => toast.success(isPreOrder ? '⏰ Pre-order added!' : '🛒 Added to cart!'), 0);
      }
      return [...prev, {
        productId: product._id,
        name: product.name,
        image: product.images?.[0] || '',
        price: product.discountPrice || product.price,
        originalPrice: product.price,
        unit: product.unit,
        slug: product.slug,
        isPreOrder,
        quantity,
        maxQty: product.quantity,
        harvestingSeason: product.harvestingSeason,
        isHarvestingSeason: product.isHarvestingSeason,
      }];
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
    toast.success('Removed from cart');
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) return removeItem(productId);
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    setCoupon(null);
    setCouponDiscount(0);
    localStorage.removeItem('si-cart');
  }, []);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = subtotal - couponDiscount;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const applyCoupon = useCallback(async (code, orderSubtotal) => {
    const amount = orderSubtotal ?? items.reduce((s, i) => s + i.price * i.quantity, 0);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase().trim(), subtotal: amount, productIds: items.map(i => i.productId) }),
      });
      const data = await res.json();
      if (data.success) {
        setCoupon(data.coupon);
        setCouponDiscount(data.discount);
        toast.success(`✅ Coupon applied — ৳${data.discount.toLocaleString()} off!`);
        return true;
      } else {
        toast.error(data.message || 'Invalid coupon');
        return false;
      }
    } catch {
      toast.error('Could not verify coupon — check your connection');
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const removeCoupon = () => { setCoupon(null); setCouponDiscount(0); };

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, applyCoupon, removeCoupon, coupon, couponDiscount, subtotal, total, itemCount, mounted }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

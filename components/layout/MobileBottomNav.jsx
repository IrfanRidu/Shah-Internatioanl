'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useCart } from '@/contexts/CartContext';
import { Home, Search, ShoppingCart, User, Layers } from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { isLocal } = useBuyerType();
  const { itemCount } = useCart();

  const tabs = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/products', icon: Search, label: 'Products' },
    ...(isLocal ? [{ href: '/cart', icon: ShoppingCart, label: 'Cart', badge: itemCount }] : []),
    { href: '/categories', icon: Layers, label: 'Categories' },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 safe-area-pb shadow-2xl">
      <div className="flex items-center justify-around px-2 py-1">
        {tabs.map(({ href, icon: Icon, label, badge }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all relative ${active ? 'text-brand' : 'text-gray-400 hover:text-gray-600'}`}>
              <div className="relative">
                <Icon className={`w-5 h-5 transition-all ${active ? 'scale-110' : ''}`} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{label}</span>
              {active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-brand" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

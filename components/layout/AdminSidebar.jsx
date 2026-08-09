'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Tag,
  Image as ImageIcon, Zap, Percent, Settings, BarChart3,
  Warehouse, Shield, Layers, FileText, LogOut, Leaf, Menu,
  Mail, MessageSquare, Star, Globe2, Ship, History, DollarSign
} from 'lucide-react';
import { getPermissions } from '@/lib/permissions';
import { useSettings } from '@/contexts/SettingsContext';

// `module` ties a nav item to a Role permission key (see lib/permissions.js).
// Items without a `module` (Dashboard, Messages, Marketing) are always shown
// to any admin-area staff member, since they're not gated by the granular
// Role matrix.
const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, module: 'analytics' },
    ],
  },
  {
    label: 'Store',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, badge: true, module: 'orders' },
      { href: '/admin/products', label: 'Products', icon: Package, module: 'products' },
      { href: '/admin/categories', label: 'Categories', icon: Layers, module: 'categories' },
      { href: '/admin/inventory', label: 'Inventory', icon: Warehouse, module: 'inventory' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: Users, module: 'customers' },
      { href: '/admin/messages', label: 'Messages', icon: MessageSquare, badge: 'messages' },
      { href: '/admin/reviews', label: 'Reviews', icon: Star, module: 'reviews' },
      { href: '/admin/marketing', label: 'Email Marketing', icon: Mail, module: 'marketing' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/admin/banners', label: 'Banners', icon: ImageIcon, module: 'banners' },
      { href: '/admin/flash-sales', label: 'Campaigns', icon: Zap, module: 'flashSales' },
      { href: '/admin/coupons', label: 'Coupons', icon: Percent, module: 'coupons' },
      { href: '/admin/sections', label: 'Sections', icon: FileText, module: 'sections' },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/pages', label: 'Pages', icon: FileText, module: 'pages' },
    ],
  },
  {
    label: 'Export & Import',
    items: [
      { href: '/admin/export-dashboard', label: 'Export Dashboard', icon: Globe2 },
      { href: '/admin/export-dashboard/incentives', label: 'Export Incentives', icon: DollarSign },
      { href: '/admin/export-dashboard/analytics', label: 'Export Analytics', icon: BarChart3 },
      { href: '/admin/export-dashboard/archive', label: 'Export Archives', icon: FileText },
      { href: '/admin/export-dashboard/audit-log', label: 'Audit Log & Recycle Bin', icon: History },
      { href: '/admin/import-dashboard', label: 'Import Dashboard', icon: Ship },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/roles', label: 'Roles', icon: Shield, superAdminOnly: true },
      { href: '/admin/settings', label: 'Settings', icon: Settings, module: 'settings' },
    ],
  },
];

export default function AdminSidebar({ pendingOrders: initialPendingOrders = 0, unreadMessages: initialUnreadMessages = 0 }) {
  const { data: session } = useSession();
  const { settings } = useSettings();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false); // always start expanded; persist after mount
  // Server-rendered counts are a good first paint, but Next.js doesn't re-run a server layout on
  // client-side sibling navigation — so without this, a badge would stay stale until a hard refresh
  // even after the admin actually read the order/message it's counting (issue 40). Re-fetch on mount,
  // on a short poll, and whenever the route changes (i.e. whenever the admin navigates away from
  // whatever they just handled).
  const [pendingOrders, setPendingOrders] = useState(initialPendingOrders);
  const [unreadMessages, setUnreadMessages] = useState(initialUnreadMessages);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetch('/api/admin/badge-counts').then(r => r.json()).then(d => {
        if (cancelled || !d?.success) return;
        setPendingOrders(d.pendingOrders);
        setUnreadMessages(d.unreadMessages);
      }).catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pathname]);

  useEffect(() => {
    // Read saved preference after mount (avoids SSR mismatch)
    try {
      const saved = localStorage.getItem('si-sidebar-collapsed');
      if (saved !== null) setCollapsed(saved === 'true');
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('si-sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  };
  const isSuperAdmin = session?.user?.role === 'superAdmin';
  const isActive = (href, exact) => exact ? pathname === href : pathname.startsWith(href);
  const badgeCount = (badge) => badge === 'messages' ? unreadMessages : badge ? pendingOrders : 0;

  // null => full access (superAdmin/admin); object => granular Role matrix for editors.
  const permissions = getPermissions(session);
  const canSeeModule = (module) => {
    if (!module) return true; // ungated items
    if (permissions === null) return true; // superAdmin/admin
    return !!permissions?.[module]?.view;
  };

  return (
    <aside className={`hidden md:flex flex-col h-screen sticky top-0 bg-gray-950 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 overflow-hidden`}>
      {/* Logo + toggle. Row layout when expanded; stacked/centered when
          collapsed so the toggle button never overflows the narrow 64px
          width and get clipped by the aside's overflow-hidden — that
          overflow was exactly why the sidebar couldn't be re-expanded once
          collapsed: the only button that could reopen it became unclickable. */}
      <div className={`flex border-b border-gray-800 flex-shrink-0 ${collapsed ? 'flex-col items-center gap-2 p-3' : 'items-center gap-3 p-4'}`}>
        {/* Logo — mirrors the storefront Header: shows the admin-uploaded site
            logo from Settings when set (issue 44: admin panel logo must change
            together with the site logo), falls back to the default Leaf mark. */}
        {settings?.logo ? (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white overflow-hidden">
            <img src={settings.logo} alt={settings?.siteTitle || 'Shah International'} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
            <Leaf className="w-5 h-5 text-white" />
          </div>
        )}
        {!collapsed && (
          <div className="overflow-hidden flex-1">
            <p className="text-white font-bold text-sm truncate leading-tight">{settings?.siteTitle || 'Shah International'}</p>
            <p className="text-gray-500 text-xs">Admin Panel</p>
          </div>
        )}
        <button onClick={toggleCollapsed} className="text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg p-1.5 flex-shrink-0 transition-colors" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
        {navGroups.map(group => {
          const visibleItems = group.items.filter(item => (!item.superAdminOnly || isSuperAdmin) && canSeeModule(item.module));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              {!collapsed && <p className="text-gray-600 text-xs font-bold uppercase tracking-widest px-3 mb-1">{group.label}</p>}
              <div className="space-y-0.5">
                {visibleItems.map(({ href, label, icon: Icon, exact, badge }) => (
                  <Link key={href} href={href}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive(href, exact) ? 'text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    style={isActive(href, exact) ? { backgroundColor: 'var(--color-primary)' } : {}}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate flex-1">{label}</span>}
                    {!collapsed && badgeCount(badge) > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-bold">
                        {badgeCount(badge) > 9 ? '9+' : badgeCount(badge)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 p-3 flex-shrink-0">
        {!collapsed && session && (
          <div className="flex items-center gap-2 px-2 py-2 mb-2 bg-gray-900 rounded-xl">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
              {session.user.name?.[0]}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-white text-xs font-semibold truncate">{session.user.name}</p>
              <p className="text-gray-500 text-xs capitalize">{session.user.role}</p>
            </div>
          </div>
        )}
        <Link href="/" title={collapsed ? 'Visit Store' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-all mb-1 ${collapsed ? 'justify-center' : ''}`}>
          <Leaf className="w-4 h-4 flex-shrink-0" />{!collapsed && 'Visit Store'}
        </Link>
        <button onClick={() => signOut({ callbackUrl: '/' })} title={collapsed ? 'Logout' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all w-full ${collapsed ? 'justify-center' : ''}`}>
          <LogOut className="w-4 h-4 flex-shrink-0" />{!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}

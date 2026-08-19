'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Tag,
  Image as ImageIcon, Zap, Percent, Settings, BarChart3, TrendingUp,
  Warehouse, Shield, Layers, FileText, LogOut, Leaf, Menu, X, ChevronDown,
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
    // Batch 19 (R33-4/5): renamed from "Export & Import" — Export Categories/Incentives/
    // Analytics/Archives/Settings are ALL already separate pages/routes (they were previously
    // reachable only via quick-link buttons duplicated at the top of the main export-dashboard
    // page itself, not from the sidebar at all) — promoted here to real sidebar items, and that
    // redundant quick-link row removed from the page (see app/admin/export-dashboard/page.jsx).
    // "Overview" is the one genuinely new page this adds. "Shipments" is the renamed main page —
    // exact:true since its href is a PREFIX of every other item below it in this same group
    // (without it, being on any of those other 7 pages would also highlight "Shipments").
    label: 'Export Dashboard',
    items: [
      { href: '/admin/export-dashboard/overview', label: 'Overview', icon: TrendingUp },
      { href: '/admin/export-dashboard', label: 'Shipments', icon: Globe2, exact: true },
      { href: '/admin/export-dashboard/categories', label: 'Export Categories', icon: Tag },
      { href: '/admin/export-dashboard/incentives', label: 'Export Incentives', icon: DollarSign },
      { href: '/admin/export-dashboard/analytics', label: 'Export Analytics', icon: BarChart3 },
      { href: '/admin/export-dashboard/archive', label: 'Export Archives', icon: FileText },
      { href: '/admin/export-dashboard/audit-log', label: 'Audit Log & Recycle Bin', icon: History },
      { href: '/admin/export-dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    // Batch 19 (R33-4): split out into its own top-level section, per "another INDIVIDUAL
    // section named Import Dashboard" — was previously just one more item nested inside the old
    // "Export & Import" group. The page itself already exists as a clearly-labeled "Coming Soon"
    // placeholder (app/admin/import-dashboard/page.jsx) — nothing to build here yet, per the
    // request ("will remain empty, instructions later").
    label: 'Import Dashboard',
    items: [
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

// Batch 17 (R8): `mobileOpen`/`onMobileClose` drive a slide-out drawer for narrow screens — the
// admin panel previously had NO way at all to reach this nav below the md breakpoint (the desktop
// `<aside>` is `hidden md:flex`, and the storefront's own MobileBottomNav explicitly excludes
// every /admin route). The drawer intentionally shows every item from every group (not a curated
// subset like a bottom tab bar would force) so "all the features... across all routes and tabs"
// stays true on mobile, not just a handful of shortcuts.
export default function AdminSidebar({ pendingOrders: initialPendingOrders = 0, unreadMessages: initialUnreadMessages = 0, mobileOpen = false, onMobileClose = () => {} }) {
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

  // Batch 19 (R33-3): which nav GROUPS (sections) are expanded — independent of `collapsed` above,
  // which is the whole-sidebar icon-only mode. Default is every group closed, per the request;
  // persisted the same way `collapsed` already is, so an admin's choice of which sections they
  // actually use sticks across visits instead of resetting closed every single time.
  const [openGroups, setOpenGroups] = useState({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem('si-sidebar-open-groups');
      if (saved) setOpenGroups(JSON.parse(saved));
    } catch {}
  }, []);
  const toggleGroup = (label) => {
    setOpenGroups(prev => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem('si-sidebar-open-groups', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // R8: close the mobile drawer automatically on every navigation, and lock background scroll
  // while it's open (a full-height overlay with the page still scrolling underneath it feels
  // broken on touch devices).
  useEffect(() => { onMobileClose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [mobileOpen]);

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

  // R8: shared between the desktop aside and the mobile drawer, parameterized by `isCollapsed` (the
  // drawer always calls this with `false` — a temporary overlay has no need to save horizontal
  // space the way the persistent desktop rail does) — so the two views render from one map() and
  // can never drift out of sync with each other.
  // Batch 19 (R33-3): each group's own label is now a clickable accordion toggle (openGroups,
  // default all-closed, above) — EXCEPT when isCollapsed (the whole-sidebar icon-only mode): there
  // are no labels to click in icon-only mode anyway, and hiding items there too would leave the
  // icon rail empty, so icon-only mode bypasses the accordion and always shows every item.
  const renderNav = (isCollapsed) => (
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
      {navGroups.map(group => {
        const visibleItems = group.items.filter(item => (!item.superAdminOnly || isSuperAdmin) && canSeeModule(item.module));
        if (visibleItems.length === 0) return null;
        const isOpen = isCollapsed || !!openGroups[group.label];
        const pendingInGroup = visibleItems.reduce((sum, item) => sum + badgeCount(item.badge), 0);
        return (
          <div key={group.label} className="pt-2">
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1 rounded-lg hover:bg-gray-900 transition-colors"
              >
                <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">{group.label}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  {!isOpen && pendingInGroup > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
            )}
            {/* max-h-[32rem]: comfortably fits even the largest group with room to spare — sized
                with headroom for the Export Dashboard group specifically, which R33-5 (later in
                this same batch) grows to 8 sub-items. */}
            <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="space-y-0.5 pt-1">
                {visibleItems.map(({ href, label, icon: Icon, exact, badge }) => (
                  <Link key={href} href={href}
                    title={isCollapsed ? label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive(href, exact) ? 'text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    style={isActive(href, exact) ? { backgroundColor: 'var(--color-primary)' } : {}}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && <span className="truncate flex-1">{label}</span>}
                    {!isCollapsed && badgeCount(badge) > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-bold">
                        {badgeCount(badge) > 9 ? '9+' : badgeCount(badge)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );

  // R8: same reasoning as renderNav above — one shared footer, never duplicated.
  const renderFooter = (isCollapsed) => (
    <div className="border-t border-gray-800 p-3 flex-shrink-0">
      {!isCollapsed && session && (
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
      <Link href="/" title={isCollapsed ? 'Visit Store' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-all mb-1 ${isCollapsed ? 'justify-center' : ''}`}>
        <Leaf className="w-4 h-4 flex-shrink-0" />{!isCollapsed && 'Visit Store'}
      </Link>
      <button onClick={() => signOut({ callbackUrl: '/' })} title={isCollapsed ? 'Logout' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all w-full ${isCollapsed ? 'justify-center' : ''}`}>
        <LogOut className="w-4 h-4 flex-shrink-0" />{!isCollapsed && 'Logout'}
      </button>
    </div>
  );

  return (
    <>
      {/* R8: mobile drawer + overlay — only ever mounted while open, md:hidden scoped so it never
          shows once the viewport is wide enough for the persistent desktop aside below. */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="absolute top-0 left-0 h-full w-72 max-w-[85vw] bg-gray-950 flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center gap-3 p-4 border-b border-gray-800 flex-shrink-0">
              {settings?.logo ? (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white overflow-hidden">
                  <img src={settings.logo} alt={settings?.siteTitle || 'Shah International'} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                  <Leaf className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="overflow-hidden flex-1">
                <p className="text-white font-bold text-sm truncate leading-tight">{settings?.siteTitle || 'Shah International'}</p>
                <p className="text-gray-500 text-xs">Admin Panel</p>
              </div>
              <button onClick={onMobileClose} className="text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg p-1.5 flex-shrink-0 transition-colors" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNav(false)}
            {renderFooter(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — unchanged from before batch 17, still hidden below md. */}
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
        {renderNav(collapsed)}
        {renderFooter(collapsed)}
      </aside>
    </>
  );
}

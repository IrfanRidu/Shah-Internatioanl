'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Moon, Sun, Menu } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import NotificationBell from '@/components/admin/NotificationBell';

export default function AdminTopBar({ session, onMenuClick }) {
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState('');
  const router = useRouter();

  const handleSearch = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      router.push(`/admin/products?search=${encodeURIComponent(search)}`);
      setSearch('');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-3 sm:px-6 py-3 flex items-center justify-between gap-3 sm:gap-4 flex-shrink-0">
      {/* R8: only ever visible below md, where the desktop <aside> in AdminSidebar is hidden — this
          is the only way into the admin nav on a phone/tablet. Placed first, in normal flow, so it
          never overlaps the search box next to it (a `fixed` floating button was considered, but
          would sit on top of whatever's beneath it instead of sharing this bar's own layout). */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search products, orders... (Enter)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleSearch}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-300 dark:text-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'green' : 'dark')}
          className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <NotificationBell />
        <div className="flex items-center gap-2 pl-3 border-l border-gray-100 dark:border-gray-800">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)' }}>
            {session?.user?.name?.[0]}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-gray-800 dark:text-white leading-tight">{session?.user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{session?.user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

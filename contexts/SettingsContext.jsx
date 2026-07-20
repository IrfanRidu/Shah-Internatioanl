'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const SettingsContext = createContext({});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/settings', { cache: 'no-store' });
      const d = await r.json();
      if (d.success) setSettings(d.settings);
    } catch {}
    setLoading(false);
  }, []);

  // Refetch on every client-side route change. SettingsProvider lives once at
  // the root layout and never remounts during normal navigation, so without
  // this, its very first fetch (on initial page load) was the ONLY fetch for
  // the entire browsing session — an admin saving a change in one tab and
  // then clicking back to the storefront would keep seeing stale data until
  // a full page reload. This was the actual cause of "changes in settings
  // don't show up on the frontend" for anything reading from useSettings().
  useEffect(() => { refresh(); }, [pathname, refresh]);

  // Also listen for an explicit 'settings-updated' event, dispatched by the
  // admin settings page right after a successful save — covers same-tab
  // admin panel usage without even needing a route change, and also covers
  // the window/tab that has the storefront open if it's listening.
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('settings-updated', handler);
    return () => window.removeEventListener('settings-updated', handler);
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

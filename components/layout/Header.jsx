'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useCart } from '@/contexts/CartContext';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/store/useStore';
import BuyerTypeModal from './BuyerTypeModal';
import SearchAutocomplete from '@/components/ui/SearchAutocomplete';
import { ShoppingCart, User, Menu, X, Globe, Sun, Moon, ChevronDown, Package, LogOut, Settings, LayoutDashboard, RefreshCw, Leaf, Heart, Search, MessageCircle } from 'lucide-react';

export default function Header() {
  const { data: session } = useSession();
  const { itemCount } = useCart();
  const { wishlist } = useStore();
  const { buyerType, setBuyerType, setShowModal } = useBuyerType();
  const { t, language, changeLanguage } = useLanguage();
  const { currency, setCurrency, CURRENCIES } = useCurrency();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [userPinned, setUserPinned] = useState(false); // stays open after click
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [currOpen, setCurrOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerLinks, setHeaderLinks] = useState([]);
  const [settings, setSettings] = useState(null);
  const isLocal = buyerType === 'local';
  const isAdmin = ['superAdmin', 'admin', 'editor'].includes(session?.user?.role);
  const pathname = usePathname();
  // Buyers previously had no unread-messages indicator anywhere (issue 40 asks that ALL notification
  // badges work, including clearing once opened) — admins get their own bell separately, so skip this
  // fetch for them to avoid a confusing double-count.
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  useEffect(() => {
    if (!session?.user?.id || isAdmin) { setUnreadMsgCount(0); return; }
    let cancelled = false;
    const refresh = () => {
      fetch('/api/messages?limit=100').then(r => r.json()).then(d => {
        if (cancelled) return;
        setUnreadMsgCount((d.conversations || []).filter(c => c.unreadByUser).length);
      }).catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 45000);
    return () => { cancelled = true; clearInterval(id); };
  }, [session?.user?.id, isAdmin, pathname]);

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).then(d => {
      const s = d.settings;
      const links = (s?.headerLinks || []).filter(l => l.title && l.url);
      setHeaderLinks(links);
      setSettings(s || null);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header className={`sticky top-0 z-40 w-full transition-all duration-300 ${scrolled ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md' : 'bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800'}`}>
        {/* Top bar */}
        <div className="text-white py-1.5 px-4 text-xs text-center hidden md:block" style={{ backgroundColor: 'var(--color-primary)' }}>
          🌿 {settings?.siteTagline || 'Premium Farm Fresh from Bangladesh'} &nbsp;|&nbsp; 📞 {settings?.contact?.phone || '+880-1681-896498'} &nbsp;|&nbsp; ✉ {settings?.contact?.email || 'shahinternational@gmail.com'} &nbsp;|&nbsp;
          <a href={`https://wa.me/${settings?.contact?.whatsapp || '8801681896498'}`} className="underline hover:no-underline">💬 WhatsApp Us</a>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo — shows uploaded logo from Settings if available, Leaf icon otherwise */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              {headerLinks.length === 0 && settings?.logo ? (
                <img src={settings.logo} alt={settings.siteTitle || 'Shah International'} className="h-9 w-auto object-contain max-w-[140px]" />
              ) : (
                <>
                  {settings?.logo ? (
                    <img src={settings.logo} alt={settings.siteTitle || 'Shah International'} className="h-9 w-auto object-contain max-w-[120px]" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--color-primary)' }}>
                      <Leaf className="w-5 h-5" />
                    </div>
                  )}
                  <div className="hidden sm:block">
                    <div className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{settings?.siteTitle || 'Shah International'}</div>
                    <div className="text-xs text-gray-400 leading-tight">{settings?.siteTagline || 'Farm Fresh · Global Reach'}</div>
                  </div>
                </>
              )}
            </Link>

            {/* Search – desktop */}
            <div className="hidden md:block flex-1 max-w-sm">
              <SearchAutocomplete placeholder="Search products..." />
            </div>

            {/* Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {[{ href: '/', label: 'Home' }, { href: '/products', label: 'Products' }, { href: '/categories', label: 'Categories' }].map(link => (
                <Link key={link.href} href={link.href} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-white transition-all"
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                  {link.label}
                </Link>
              ))}
              {headerLinks.map((link, i) => (
                <a key={`custom-${i}`} href={link.url} target={link.isExternal ? '_blank' : undefined} rel={link.isExternal ? 'noreferrer' : undefined}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-white transition-all"
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                  {link.title}
                </a>
              ))}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-1.5">
              {/* Mobile search toggle */}
              <button onClick={() => setSearchOpen(!searchOpen)} className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                <Search className="w-5 h-5" />
              </button>

              {/* Buyer toggle */}
              <button onClick={() => setShowModal(true)} className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-all" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                <RefreshCw className="w-3 h-3" />{isLocal ? '🇧🇩 Local' : '🌍 Import'}
              </button>

              {/* Currency */}
              <div className="relative hidden lg:block">
                <button onClick={() => { setCurrOpen(!currOpen); setLangOpen(false); }} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                  {currency} <ChevronDown className="w-3 h-3" />
                </button>
                {currOpen && (
                  <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50 min-w-[80px]">
                    {CURRENCIES.map(c => (
                      <button key={c} onClick={() => { setCurrency(c); setCurrOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${c === currency ? 'font-bold text-brand' : 'text-gray-700 dark:text-gray-300'}`}>{c}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Language */}
              <div className="relative hidden lg:block">
                <button onClick={() => { setLangOpen(!langOpen); setCurrOpen(false); }} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <Globe className="w-3.5 h-3.5" />{language.toUpperCase()} <ChevronDown className="w-3 h-3" />
                </button>
                {langOpen && (
                  <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50">
                    {[{ code: 'en', label: 'English' }, { code: 'bn', label: 'বাংলা' }].map(l => (
                      <button key={l.code} onClick={() => { changeLanguage(l.code); setLangOpen(false); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap ${l.code === language ? 'font-bold text-brand' : 'text-gray-700 dark:text-gray-300'}`}>{l.label}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Theme */}
              <button onClick={() => setTheme(theme === 'dark' ? 'green' : 'dark')} className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hidden md:flex">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Wishlist */}
              <Link href="/wishlist" className="relative p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hidden md:flex">
                <Heart className="w-5 h-5" />
                {wishlist.length > 0 && <span className="absolute -top-1 -right-1 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ef4444' }}>{wishlist.length}</span>}
              </Link>

              {/* Cart */}
              {isLocal && (
                <Link href="/cart" className="relative p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ShoppingCart className="w-5 h-5" />
                  {itemCount > 0 && <span className="absolute -top-1 -right-1 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent)' }}>{itemCount > 9 ? '9+' : itemCount}</span>}
                </Link>
              )}

              {/* User dropdown — opens on hover, stays pinned on click, closes on 2nd click */}
              {session ? (
                <div className="relative"
                  onMouseEnter={() => setUserOpen(true)}
                  onMouseLeave={() => { if (!userPinned) setUserOpen(false); }}>
                  <button
                    onClick={() => {
                      // Single source of truth: toggling `pinned` also drives `open`
                      // directly inside the same updater, so there's no race between
                      // two separate setState calls. Click 1: pins + opens.
                      // Click 2: un-pins + closes. (Previously an unconditional
                      // `setUserOpen(true)` ran right after the pin toggle on every
                      // click, which silently overrode the intended close on the
                      // second click — that's why it wouldn't collapse.)
                      setUserPinned(prev => {
                        const next = !prev;
                        setUserOpen(next);
                        return next;
                      });
                    }}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200">
                    {session.user.avatar ? (
                      <img src={session.user.avatar} alt={session.user.name} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)' }}>{session.user.name?.[0]}</div>
                    )}
                    <span className="hidden sm:block max-w-[80px] truncate">{session.user.name?.split(' ')[0]}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${userOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {userOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50"
                      onClick={() => { setUserOpen(false); setUserPinned(false); }}>
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                        {session.user.avatar && <img src={session.user.avatar} alt={session.user.name} className="w-10 h-10 rounded-full object-cover mb-2" />}
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{session.user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                      </div>
                      {isAdmin && <Link href="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"><LayoutDashboard className="w-4 h-4 text-brand" /> Admin Panel</Link>}
                      <Link href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"><User className="w-4 h-4" /> My Profile</Link>
                      <Link href="/orders" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"><Package className="w-4 h-4" /> My Orders</Link>
                      <Link href="/messages" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <MessageCircle className="w-4 h-4" /> Messages
                        {unreadMsgCount > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{unreadMsgCount > 9 ? '9+' : unreadMsgCount}</span>}
                      </Link>
                      <Link href="/wishlist" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"><Heart className="w-4 h-4" /> Wishlist {wishlist.length > 0 && <span className="ml-auto bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">{wishlist.length}</span>}</Link>
                      <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                        <button onClick={() => signOut({ callbackUrl: '/' })} className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"><LogOut className="w-4 h-4" /> Logout</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login" className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 transition-colors">Login</Link>
                  <Link href="/register" className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Register</Link>
                </div>
              )}

              {/* Mobile menu */}
              <button className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile search */}
        {searchOpen && (
          <div className="md:hidden px-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <SearchAutocomplete placeholder="Search products..." />
          </div>
        )}

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-4 px-4 space-y-1">
            {[{ href: '/', label: '🏠 Home' }, { href: '/products', label: '🥦 Products' }, { href: '/categories', label: '📂 Categories' }, { href: '/wishlist', label: '❤️ Wishlist' }, { href: '/orders', label: '📦 My Orders' }, { href: '/messages', label: '💬 Messages', badge: unreadMsgCount }].map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium text-sm">
                <span>{l.label}</span>
                {l.badge > 0 && <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{l.badge > 9 ? '9+' : l.badge}</span>}
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
              <button onClick={() => { setShowModal(true); setMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                🔄 {isLocal ? 'Switch to International' : 'Switch to Local'}
              </button>
              <div className="flex gap-2 px-4">
                <button onClick={() => setTheme(theme === 'dark' ? 'green' : 'dark')} className="text-xs text-gray-500 flex items-center gap-1">{theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />} Theme</button>
                <button onClick={() => changeLanguage(language === 'en' ? 'bn' : 'en')} className="text-xs text-gray-500 flex items-center gap-1 ml-3"><Globe className="w-3.5 h-3.5" /> {language === 'en' ? 'বাংলা' : 'English'}</button>
              </div>
            </div>
          </div>
        )}
      </header>
      <BuyerTypeModal />
    </>
  );
}

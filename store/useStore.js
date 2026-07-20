import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // UI state
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

      // Recently viewed products
      recentlyViewed: [],
      addRecentlyViewed: (product) => set(state => ({
        recentlyViewed: [product, ...state.recentlyViewed.filter(p => p._id !== product._id)].slice(0, 10),
      })),

      // Wishlist
      wishlist: [],
      toggleWishlist: (product) => set(state => ({
        wishlist: state.wishlist.find(p => p._id === product._id)
          ? state.wishlist.filter(p => p._id !== product._id)
          : [...state.wishlist, product],
      })),
      isWishlisted: (productId) => get().wishlist.some(p => p._id === productId),

      // Notification preferences
      notificationsEnabled: true,
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
    }),
    {
      name: 'shah-intl-store',
      partialize: (state) => ({
        recentlyViewed: state.recentlyViewed,
        wishlist: state.wishlist,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

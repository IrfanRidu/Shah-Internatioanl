import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';

export const useCompareStore = create(
  persist(
    (set, get) => ({
      items: [],
      addToCompare: (product) => {
        const items = get().items;
        if (items.find(p => p._id === product._id)) {
          toast('Already in compare list');
          return;
        }
        if (items.length >= 3) {
          toast.error('Max 3 products for comparison');
          return;
        }
        set({ items: [...items, product] });
        toast.success('Added to compare!');
      },
      removeFromCompare: (productId) => set(s => ({ items: s.items.filter(p => p._id !== productId) })),
      clearCompare: () => set({ items: [] }),
      isInCompare: (productId) => get().items.some(p => p._id === productId),
    }),
    { name: 'si-compare', partialize: s => ({ items: s.items }) }
  )
);

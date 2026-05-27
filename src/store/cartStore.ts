import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty: number) => void;
  updateQty: (productId: string, orderedAs: "KG" | "PIECE", qty: number) => void;
  removeItem: (productId: string, orderedAs: "KG" | "PIECE") => void;
  clearCart: () => void;
  total: () => number;
  count: () => number;
}

function cartKey(productId: string, orderedAs: "KG" | "PIECE") {
  return `${productId}::${orderedAs}`;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem(item, qty) {
        set((s) => {
          const existing = s.items.find(
            (i) => i.productId === item.productId && i.orderedAs === item.orderedAs
          );
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === item.productId && i.orderedAs === item.orderedAs
                  ? { ...i, qty: i.qty + qty }
                  : i
              ),
            };
          }
          return { items: [...s.items, { ...item, qty }] };
        });
      },

      updateQty(productId, orderedAs, qty) {
        if (qty <= 0) {
          get().removeItem(productId, orderedAs);
          return;
        }
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId && i.orderedAs === orderedAs ? { ...i, qty } : i
          ),
        }));
      },

      removeItem(productId, orderedAs) {
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.productId === productId && i.orderedAs === orderedAs)
          ),
        }));
      },

      clearCart() {
        set({ items: [] });
      },

      total() {
        return get().items.reduce((sum, i) => sum + i.pricePerUnit * i.qty, 0);
      },

      count() {
        return get().items.length;
      },
    }),
    { name: "ikiwi-cart" }
  )
);

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { StorefrontProductCard } from "@/features/storefront/types";

export interface CartItem {
  productId: string;
  productKey: string;
  name: string;
  imageUrl: string | null;
  price: number;
  taxRate: number;
  quantity: number;
  stockAvailable: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (product: StorefrontProductCard, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  subtotal: number;
  taxTotal: number;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(storeSlug: string) {
  return `storefront-cart:${storeSlug}`;
}

export function CartProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(storeSlug));
      if (!raw) return;
      const parsed = JSON.parse(raw) as CartItem[];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      setItems([]);
    }
  }, [storeSlug]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(storeSlug), JSON.stringify(items));
  }, [items, storeSlug]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
      0,
    );

    return {
      items,
      addItem(product, quantity) {
        const qty = Math.max(1, Math.floor(quantity || 1));
        setItems((current) => {
          const existing = current.find((item) => item.productId === product.id);
          if (existing) {
            return current.map((item) =>
              item.productId === product.id
                ? {
                    ...item,
                    quantity: Math.min(
                      item.quantity + qty,
                      Math.max(1, Math.floor(product.totalStock || item.stockAvailable || 9999)),
                    ),
                    stockAvailable: Math.max(1, Math.floor(product.totalStock || item.stockAvailable || 9999)),
                  }
                : item,
            );
          }
          return [
            ...current,
            {
              productId: product.id,
              productKey: product.key,
              name: product.name,
              imageUrl: product.imageUrl,
              price: product.price,
              taxRate: product.taxRate,
              quantity: Math.min(qty, Math.max(1, Math.floor(product.totalStock || 9999))),
              stockAvailable: Math.max(1, Math.floor(product.totalStock || 9999)),
            },
          ];
        });
      },
      updateQuantity(productId, quantity) {
        setItems((current) =>
          current
            .map((item) =>
              item.productId === productId
                ? {
                    ...item,
                    quantity: Math.max(1, Math.min(Math.floor(quantity || 1), item.stockAvailable || 9999)),
                  }
                : item,
            )
            .filter((item) => item.quantity > 0),
        );
      },
      removeItem(productId) {
        setItems((current) => current.filter((item) => item.productId !== productId));
      },
      clear() {
        setItems([]);
      },
      subtotal,
      taxTotal,
      total: subtotal + taxTotal,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}

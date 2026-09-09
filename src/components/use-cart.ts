"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseCart, type CartItem } from "@/lib/shop";

let memoryCart: string | null = null;
let useMemoryCart = false;
const getSnapshot = () => {
  if (useMemoryCart) return memoryCart;
  try {
    return localStorage.getItem("dormside_cart");
  } catch {
    return memoryCart;
  }
};
const getServerSnapshot = () => null;
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("dormside-cart-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("dormside-cart-change", callback);
  };
};

export function useCart() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const cartItems = useMemo(() => parseCart(raw), [raw]);
  const setCartItems = (
    update: CartItem[] | ((items: CartItem[]) => CartItem[]),
  ) => {
    const items =
      typeof update === "function" ? update(parseCart(getSnapshot())) : update;
    memoryCart = JSON.stringify(items);
    try {
      localStorage.setItem("dormside_cart", memoryCart);
    } catch {
      useMemoryCart = true;
    }
    window.dispatchEvent(new Event("dormside-cart-change"));
  };
  return { cartItems, setCartItems };
}

const preferenceMemory = new Map<string, string>();
export function usePreference(key: string, defaultValue: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      if (preferenceMemory.has(key)) return preferenceMemory.get(key)!;
      try {
        return localStorage.getItem(key) ?? defaultValue;
      } catch {
        return preferenceMemory.get(key) ?? defaultValue;
      }
    },
    () => defaultValue,
  );
  const setValue = (next: string) => {
    try {
      localStorage.setItem(key, next);
      preferenceMemory.delete(key);
    } catch {
      preferenceMemory.set(key, next);
    }
    window.dispatchEvent(new Event("dormside-cart-change"));
  };
  return [value, setValue] as const;
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function clearCart() {
  memoryCart = "[]";
  try {
    localStorage.removeItem("dormside_cart");
  } catch {
    useMemoryCart = true;
  }
  window.dispatchEvent(new Event("dormside-cart-change"));
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const fallbackMenu = [
  {
    name: "Mac and Cheese",
    description: "Creamy cheddar sauce, toasted breadcrumb finish.",
    price: "$9.50",
  },
  {
    name: "Fried Chicken",
    description: "Crispy buttermilk chicken with house pickles.",
    price: "$12.00",
  },
  {
    name: "Fresh Bread",
    description: "Warm artisan loaf with whipped herb butter.",
    price: "$4.25",
  },
];

type MenuItem = {
  name: string;
  description: string;
  price: string;
};

type CartItem = MenuItem & { quantity: number };

const parsePrice = (price: string) =>
  Number(price.replace(/[^0-9.]/g, "")) || 0;

export default function Home() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(fallbackMenu);
  const [isLoading, setIsLoading] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [isOpen, setIsOpen] = useState(true);

  const loadMenu = useCallback(async () => {
    try {
      const response = await fetch("/api/menu", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load menu");
      }
      const data = (await response.json()) as { items: MenuItem[] };
      if (Array.isArray(data.items) && data.items.length > 0) {
        setMenuItems(data.items);
      }
    } catch {
      setMenuItems(fallbackMenu);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const data = (await response.json()) as { isOpen?: boolean };
      setIsOpen(data.isOpen ?? true);
    } catch {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    loadMenu();
    loadStatus();
    const interval = setInterval(() => {
      loadMenu();
      loadStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadMenu, loadStatus]);

  useEffect(() => {
    const stored = localStorage.getItem("dormside_cart");
    if (stored) {
      try {
        setCartItems(JSON.parse(stored) as CartItem[]);
      } catch {
        localStorage.removeItem("dormside_cart");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("dormside_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + parsePrice(item.price) * item.quantity,
        0,
      ),
    [cartItems],
  );

  const addToCart = (item: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((entry) => entry.name === item.name);
      if (existing) {
        return prev.map((entry) =>
          entry.name === item.name
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (name: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.name === name
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    if (cartItems.length === 0 || !isOpen) {
      return;
    }
    setIsCheckoutOpen(true);
  };

  const handlePlaceOrder = () => {
    if (cartItems.length === 0 || !isOpen) {
      return;
    }
    localStorage.setItem("dormside_payment_method", paymentMethod);
    setIsCheckoutOpen(false);
    window.location.href = "/checkout";
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-zinc-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-130 w-130 -translate-x-1/2 rounded-full bg-linear-to-tr from-[#ffddb4] via-[#c3dafe] to-[#d4f4ff] blur-3xl opacity-60" />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 pb-20 pt-10 sm:px-10">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white">
                DS
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Dormside
                </p>
                <p className="text-lg font-semibold">Online Ordering</p>
              </div>
            </div>
            <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-600 md:flex">
              <a className="transition hover:text-zinc-900" href="#menu">
                Menu
              </a>
            </nav>
            <button className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50">
              Cart ({cartCount})
            </button>
          </header>

          <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col gap-7">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 shadow-sm">
                Simple ordering
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl">
                A clean, fast way to order your favorites.
              </h1>
              <p className="text-lg leading-8 text-zinc-600">
                Browse a focused menu, add items in seconds, and check out with
                secure payments. Designed to feel smooth on any device.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <a
                  href="#menu"
                  className="w-full rounded-full border border-zinc-200 bg-white px-6 py-3 text-center text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:w-auto"
                >
                  View menu
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white/70 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-500">Today</p>
                  <p className="text-xl font-semibold">Menu highlights</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isOpen
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isOpen ? "Open now" : "Orders closed (will open soon)"}
                </span>
              </div>
              <div className="mt-6 space-y-4">
                {isLoading ? (
                  <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                    <div className="h-4 w-28 animate-pulse rounded-full bg-zinc-200" />
                    <div className="mt-3 h-3 w-48 animate-pulse rounded-full bg-zinc-200" />
                    <div className="mt-5 h-9 w-full animate-pulse rounded-xl bg-zinc-200" />
                  </div>
                ) : (
                  menuItems.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-zinc-900">
                            {item.name}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {item.description}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {item.price}
                        </p>
                      </div>
                      <button
                        onClick={() => addToCart(item)}
                        disabled={!isOpen}
                        className="mt-4 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isOpen ? "Add to cart" : "Ordering disabled"}
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-500">
                    Your cart
                  </p>
                  <p className="text-xs text-zinc-400">
                    {cartItems.length === 0
                      ? "Empty"
                      : `${cartItems.length} items`}
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {cartItems.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Add items to begin your order.
                    </p>
                  ) : (
                    cartItems.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-4 rounded-xl bg-[#f7f8fb] px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">
                            {item.name}
                          </p>
                          <p className="text-xs text-zinc-500">{item.price}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.name, -1)}
                            className="h-8 w-8 rounded-full border border-zinc-200 text-sm font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-white"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-zinc-700">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.name, 1)}
                            className="h-8 w-8 rounded-full border border-zinc-200 text-sm font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-white"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
                  <div>
                    <p className="text-xs text-zinc-500">Order total</p>
                    <p className="text-lg font-semibold text-zinc-900">
                      ${cartTotal.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={cartItems.length === 0 || !isOpen}
                    className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Checkout
                  </button>
                </div>
                {!isOpen && (
                  <p className="mt-3 text-xs text-amber-600">
                    Orders are closed right now. Please check back soon.
                  </p>
                )}
                {isCheckoutOpen && (
                  <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-zinc-900">
                        Checkout
                      </p>
                      <button
                        onClick={() => setIsCheckoutOpen(false)}
                        className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-700"
                      >
                        Close
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      Choose your payment method and continue to checkout.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={() => setPaymentMethod("cash")}
                        className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                          paymentMethod === "cash"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                        }`}
                      >
                        Pay with cash
                        <span className="mt-1 block text-xs font-normal text-zinc-500">
                          Pay when you pick up your order.
                        </span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod("card")}
                        className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                          paymentMethod === "card"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                        }`}
                      >
                        Pay online
                        <span className="mt-1 block text-xs font-normal text-zinc-500">
                          Card and wallet payments with Stripe.
                        </span>
                      </button>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <a
                        href="#menu"
                        onClick={() => setIsCheckoutOpen(false)}
                        className="text-sm font-semibold text-zinc-600 transition hover:text-zinc-900"
                      >
                        Add more items
                      </a>
                      <button
                        onClick={handlePlaceOrder}
                        disabled={!isOpen}
                        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20"
                      >
                        Continue to checkout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      <section id="menu" className="bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20 sm:px-10">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Menu
            </p>
            <h2 className="text-3xl font-semibold text-zinc-900">
              A focused selection, always fresh.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-zinc-600">
              Browse the essentials, customize your order, and check out in
              seconds — simple and reliable.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "Clear item details",
                description:
                  "Everything you need at a glance: ingredients, price, and notes.",
              },
              {
                title: "Quick add",
                description:
                  "Add items in a tap and keep totals up to date instantly.",
              },
              {
                title: "Smooth checkout",
                description:
                  "Secure payments with instant confirmation and receipts.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-3xl border border-zinc-100 bg-[#f7f8fb] p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-zinc-900">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#0b1120] text-white/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 text-sm sm:px-10 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Dormside Ordering. All rights reserved.</p>
          <div className="flex gap-6">
            <span>Security</span>
            <span>Privacy</span>
            <span>Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

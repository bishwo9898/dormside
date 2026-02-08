"use client";

import { useEffect, useState } from "react";

type MenuItem = {
  name: string;
  description: string;
  price: string;
};

type OrderRecord = {
  id: string;
  createdAt: string;
  status: "pending" | "paid" | "cash_pending";
  fulfillment: "pickup" | "delivery";
  paymentMethod: "cash" | "card";
  tip: number;
  deliveryFee: number;
  total: number;
  items: Array<{ name: string; price: string; quantity: number }>;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
};

const emptyItem: MenuItem = {
  name: "",
  description: "",
  price: "",
};

export default function AdminPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadMenu = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/menu", { cache: "no-store" });
      const data = (await response.json()) as { items: MenuItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrders = async () => {
    setIsOrdersLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = (await response.json()) as { orders: OrderRecord[] };
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const loadSettings = async () => {
    setIsSettingsLoading(true);
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const data = (await response.json()) as { isOpen?: boolean };
      setIsOpen(data.isOpen ?? true);
    } finally {
      setIsSettingsLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
    loadOrders();
    loadSettings();
  }, []);

  const deleteOrder = async (id: string) => {
    await fetch("/api/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadOrders();
  };

  const handleChange = (
    index: number,
    field: keyof MenuItem,
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...emptyItem }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveMenu = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      const data = (await response.json()) as { items: MenuItem[] };
      setItems(data.items);
      setMessage("Menu updated successfully.");
    } catch {
      setMessage("Unable to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStoreStatus = async () => {
    setIsSettingsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: !isOpen }),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      const data = (await response.json()) as { isOpen?: boolean };
      setIsOpen(data.isOpen ?? !isOpen);
    } finally {
      setIsSettingsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Admin panel
            </p>
            <h1 className="text-3xl font-semibold">Menu management</h1>
            <p className="mt-2 text-sm text-white/70">
              Update menu items and prices. Changes sync instantly with the
              customer view.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </button>
            <button
              onClick={loadMenu}
              className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Refresh
            </button>
            <button
              onClick={addItem}
              className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Add item
            </button>
            <button
              onClick={saveMenu}
              disabled={isSaving}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </header>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          {message ? (
            <p className="text-sm text-emerald-200">{message}</p>
          ) : (
            <p className="text-sm text-white/60">
              Keep names short and clear. Prices should include the currency
              symbol.
            </p>
          )}
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Store status
              </p>
              <p className="mt-2 text-lg font-semibold">
                {isSettingsLoading
                  ? "Loading status..."
                  : isOpen
                    ? "Open now"
                    : "Orders closed"}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {isOpen
                  ? "Customers can place orders right now."
                  : "Customers will see the closed message and cannot order."}
              </p>
            </div>
            <button
              onClick={toggleStoreStatus}
              disabled={isSettingsLoading || isSettingsSaving}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSettingsSaving
                ? "Saving..."
                : isOpen
                  ? "Close orders"
                  : "Open orders"}
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-lg font-semibold">Menu items</h2>
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[0, 1, 2].map((key) => (
                <div
                  key={key}
                  className="h-44 animate-pulse rounded-3xl bg-white/10"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-4">
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                        Item name
                        <input
                          value={item.name}
                          onChange={(event) =>
                            handleChange(index, "name", event.target.value)
                          }
                          placeholder="Item name"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                        Description
                        <input
                          value={item.description}
                          onChange={(event) =>
                            handleChange(
                              index,
                              "description",
                              event.target.value,
                            )
                          }
                          placeholder="Short description"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                        Price
                        <input
                          value={item.price}
                          onChange={(event) =>
                            handleChange(index, "price", event.target.value)
                          }
                          placeholder="$0.00"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                        />
                      </label>
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/20"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Orders</h2>
            <button
              onClick={loadOrders}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Refresh orders
            </button>
          </div>
          {isOrdersLoading ? (
            <div className="grid gap-6">
              {[0, 1].map((key) => (
                <div
                  key={key}
                  className="h-36 animate-pulse rounded-3xl bg-white/10"
                />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              No orders yet.
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {order.customer.name}
                      </p>
                      <p className="text-sm text-white/70">
                        {order.customer.email}
                      </p>
                      <p className="text-sm text-white/70">
                        {order.customer.phone}
                      </p>
                      {order.fulfillment === "delivery" && (
                        <p className="text-sm text-white/70">
                          {order.customer.address}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        ${order.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-white/60">
                        {order.fulfillment === "delivery"
                          ? "Delivery"
                          : "Pickup"}
                      </p>
                      <p className="text-xs text-white/60">
                        {order.paymentMethod === "cash" ? "Cash" : "Card"}
                      </p>
                      <p className="mt-2 text-xs text-white/50">
                        Status: {order.status}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {order.items.map((item, idx) => (
                      <div
                        key={`${order.id}-${idx}`}
                        className="flex items-center justify-between text-sm text-white/70"
                      >
                        <span>
                          {item.quantity}× {item.name}
                        </span>
                        <span>{item.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
                    <span>Tip: ${order.tip.toFixed(2)}</span>
                    <span>Delivery fee: ${order.deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

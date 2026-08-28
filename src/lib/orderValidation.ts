import "server-only";

import { getMenu } from "@/lib/menuStore";

export type CheckoutItem = {
  name: string;
  quantity: number;
};

export type CustomerInput = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
};

export type ValidatedOrder = {
  items: Array<{ name: string; price: string; quantity: number }>;
  fulfillment: "pickup" | "delivery";
  deliveryFee: number;
  tip: number;
  total: number;
  customer: { name: string; email: string; phone: string; address: string };
};

const parsePrice = (price: string) => Number(price.replace(/[^0-9.]/g, ""));
const money = (value: number) => Math.round(value * 100) / 100;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const validateOrder = async (body: {
  items?: CheckoutItem[];
  fulfillment?: unknown;
  tip?: unknown;
  customer?: CustomerInput;
}): Promise<ValidatedOrder> => {
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 30) {
    throw new Error("Your cart is invalid. Please return to the menu and try again.");
  }

  const menu = await getMenu();
  const menuByName = new Map(menu.map((item) => [item.name, item]));
  const quantityByName = new Map<string, number>();

  for (const item of body.items) {
    if (!item || typeof item.name !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
      throw new Error("Your cart contains an invalid item.");
    }
    if (!menuByName.has(item.name)) {
      throw new Error("A menu item changed. Please return to the menu and review your cart.");
    }
    quantityByName.set(item.name, (quantityByName.get(item.name) ?? 0) + item.quantity);
  }

  const items = [...quantityByName.entries()].map(([name, quantity]) => {
    if (quantity > 50) throw new Error("Please limit each item to 50 per order.");
    const item = menuByName.get(name)!;
    const price = parsePrice(item.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("One of the menu prices is unavailable. Please contact us before ordering.");
    }
    return { name: item.name, price: item.price, quantity };
  });

  const fulfillment = body.fulfillment === "delivery" ? "delivery" : "pickup";
  const rawTip = typeof body.tip === "number" || typeof body.tip === "string" ? Number(body.tip) : 0;
  if (!Number.isFinite(rawTip) || rawTip < 0 || rawTip > 500) {
    throw new Error("Please enter a valid tip amount.");
  }
  const tip = money(rawTip);
  const deliveryFee = fulfillment === "delivery" ? 3 : 0;

  const customer = body.customer ?? {};
  const name = text(customer.name);
  const email = text(customer.email).toLowerCase();
  const phone = text(customer.phone);
  const address = text(customer.address);
  if (name.length < 2 || name.length > 120) throw new Error("Please enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Please enter a valid email address.");
  }
  if (phone.replace(/\D/g, "").length < 7 || phone.length > 40) {
    throw new Error("Please enter a valid phone number.");
  }
  if (fulfillment === "delivery" && (address.length < 4 || address.length > 240)) {
    throw new Error("Please enter a delivery building and room number.");
  }

  const subtotal = items.reduce((sum, item) => sum + parsePrice(item.price) * item.quantity, 0);
  return {
    items,
    fulfillment,
    deliveryFee,
    tip,
    total: money(subtotal + deliveryFee + tip),
    customer: { name, email, phone, address: fulfillment === "delivery" ? address : "" },
  };
};

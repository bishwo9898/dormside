import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { kv } from "@vercel/kv";

export type OrderItem = {
  name: string;
  price: string;
  quantity: number;
};

export type OrderCustomer = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type OrderRecord = {
  id: string;
  createdAt: string;
  status: "pending" | "paid" | "cash_pending";
  fulfillment: "pickup" | "delivery";
  paymentMethod: "cash" | "card";
  tip: number;
  deliveryFee: number;
  total: number;
  items: OrderItem[];
  customer: OrderCustomer;
};

const ordersPath = path.join(process.cwd(), "src", "data", "orders.json");
const kvKey = "dormside:orders";
const useKv = Boolean(process.env.KV_URL);

const readOrdersFile = async (): Promise<OrderRecord[]> => {
  if (useKv) {
    const data = await kv.get<OrderRecord[]>(kvKey);
    return Array.isArray(data) ? data : [];
  }

  try {
    const file = await fs.readFile(ordersPath, "utf-8");
    const data = JSON.parse(file) as { orders?: OrderRecord[] };
    return Array.isArray(data.orders) ? data.orders : [];
  } catch {
    return [];
  }
};

const writeOrdersFile = async (orders: OrderRecord[]) => {
  if (useKv) {
    await kv.set(kvKey, orders);
    return;
  }
  const payload = JSON.stringify({ orders }, null, 2);
  await fs.writeFile(ordersPath, payload, "utf-8");
};

export const listOrders = async (): Promise<OrderRecord[]> => {
  return readOrdersFile();
};

export const createOrder = async (
  order: Omit<OrderRecord, "id" | "createdAt">
): Promise<OrderRecord> => {
  const orders = await readOrdersFile();
  const record: OrderRecord = {
    ...order,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  orders.unshift(record);
  await writeOrdersFile(orders);
  return record;
};

export const updateOrderStatus = async (
  id: string,
  status: OrderRecord["status"]
) => {
  const orders = await readOrdersFile();
  const next = orders.map((order) =>
    order.id === id ? { ...order, status } : order
  );
  await writeOrdersFile(next);
  return next.find((order) => order.id === id) ?? null;
};

export const deleteOrder = async (id: string) => {
  const orders = await readOrdersFile();
  const next = orders.filter((order) => order.id !== id);
  await writeOrdersFile(next);
  return orders.length !== next.length;
};

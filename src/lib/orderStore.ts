import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Pool } from "pg";

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
const databaseUrl = process.env.DATABASE_URL;
const useDatabase = Boolean(databaseUrl);
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

const globalForPg = globalThis as unknown as { pgPool?: Pool };
const pool =
  globalForPg.pgPool ??
  (databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
      })
    : null);

if (!globalForPg.pgPool && pool) {
  globalForPg.pgPool = pool;
}

const ensureOrdersTable = async () => {
  if (!pool) {
    return;
  }

  await pool.query(`
    create table if not exists orders (
      id uuid primary key,
      created_at timestamptz not null,
      status text not null,
      fulfillment text not null,
      payment_method text not null,
      tip numeric not null,
      delivery_fee numeric not null,
      total numeric not null,
      items jsonb not null,
      customer jsonb not null
    );
  `);
};

const readOrdersFile = async (): Promise<OrderRecord[]> => {
  if (useDatabase && pool) {
    await ensureOrdersTable();
    const result = await pool.query(
      `select id, created_at, status, fulfillment, payment_method, tip, delivery_fee, total, items, customer
       from orders
       order by created_at desc`,
    );
    return result.rows.map((row) => ({
      id: row.id as string,
      createdAt: new Date(row.created_at as string).toISOString(),
      status: row.status as OrderRecord["status"],
      fulfillment: row.fulfillment as OrderRecord["fulfillment"],
      paymentMethod: row.payment_method as OrderRecord["paymentMethod"],
      tip: Number(row.tip),
      deliveryFee: Number(row.delivery_fee),
      total: Number(row.total),
      items: row.items as OrderItem[],
      customer: row.customer as OrderCustomer,
    }));
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
  if (useDatabase) {
    return;
  }

  if (isVercel) {
    throw new Error(
      "Orders storage is not configured. Set DATABASE_URL to a Postgres database.",
    );
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
  if (useDatabase && pool) {
    await ensureOrdersTable();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const result = await pool.query(
      `insert into orders (id, created_at, status, fulfillment, payment_method, tip, delivery_fee, total, items, customer)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
       returning id, created_at, status, fulfillment, payment_method, tip, delivery_fee, total, items, customer`,
      [
        id,
        createdAt,
        order.status,
        order.fulfillment,
        order.paymentMethod,
        order.tip,
        order.deliveryFee,
        order.total,
        JSON.stringify(order.items),
        JSON.stringify(order.customer),
      ],
    );
    const row = result.rows[0];
    return {
      id: row.id as string,
      createdAt: new Date(row.created_at as string).toISOString(),
      status: row.status as OrderRecord["status"],
      fulfillment: row.fulfillment as OrderRecord["fulfillment"],
      paymentMethod: row.payment_method as OrderRecord["paymentMethod"],
      tip: Number(row.tip),
      deliveryFee: Number(row.delivery_fee),
      total: Number(row.total),
      items: row.items as OrderItem[],
      customer: row.customer as OrderCustomer,
    };
  }

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
  if (useDatabase && pool) {
    await ensureOrdersTable();
    const result = await pool.query(
      `update orders set status = $1 where id = $2
       returning id, created_at, status, fulfillment, payment_method, tip, delivery_fee, total, items, customer`,
      [status, id],
    );
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      id: row.id as string,
      createdAt: new Date(row.created_at as string).toISOString(),
      status: row.status as OrderRecord["status"],
      fulfillment: row.fulfillment as OrderRecord["fulfillment"],
      paymentMethod: row.payment_method as OrderRecord["paymentMethod"],
      tip: Number(row.tip),
      deliveryFee: Number(row.delivery_fee),
      total: Number(row.total),
      items: row.items as OrderItem[],
      customer: row.customer as OrderCustomer,
    };
  }

  const orders = await readOrdersFile();
  const next = orders.map((order) =>
    order.id === id ? { ...order, status } : order,
  );
  await writeOrdersFile(next);
  return next.find((order) => order.id === id) ?? null;
};

export const deleteOrder = async (id: string) => {
  if (useDatabase && pool) {
    await ensureOrdersTable();
    const result = await pool.query(`delete from orders where id = $1`, [id]);
    return result.rowCount > 0;
  }

  const orders = await readOrdersFile();
  const next = orders.filter((order) => order.id !== id);
  await writeOrdersFile(next);
  return orders.length !== next.length;
};

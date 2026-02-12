import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

import menuSeed from "@/data/menu.json";

export type MenuItem = {
  name: string;
  description: string;
  price: string;
};

type MenuRow = {
  name: string;
  description: string;
  price: string;
};

const menuPath = path.join(process.cwd(), "src", "data", "menu.json");
const databaseUrl = process.env.DATABASE_URL;
const useDatabase = Boolean(databaseUrl);
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const fallbackMenu = Array.isArray(menuSeed.items)
  ? (menuSeed.items as MenuItem[])
  : [];

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

const ensureMenuTable = async () => {
  if (!pool) {
    return;
  }

  await pool.query(`
    create table if not exists menu_items (
      name text primary key,
      description text not null,
      price text not null
    );
  `);
};

const isValidItem = (item: MenuItem) =>
  Boolean(item.name?.trim()) &&
  Boolean(item.description?.trim()) &&
  Boolean(item.price?.trim());

export const getMenu = async (): Promise<MenuItem[]> => {
  if (useDatabase && pool) {
    await ensureMenuTable();
    const result = await pool.query<MenuRow>(
      "select name, description, price from menu_items order by name",
    );
    return result.rows.map((row) => ({
      name: row.name,
      description: row.description,
      price: row.price,
    }));
  }

  try {
    const file = await fs.readFile(menuPath, "utf-8");
    const data = JSON.parse(file) as { items?: MenuItem[] };
    if (Array.isArray(data.items)) {
      return data.items.length > 0 ? data.items : fallbackMenu;
    }
    return fallbackMenu;
  } catch {
    return fallbackMenu;
  }
};

export const updateMenu = async (items: MenuItem[]): Promise<MenuItem[]> => {
  const sanitized = items.filter(isValidItem).map((item) => ({
    name: item.name.trim(),
    description: item.description.trim(),
    price: item.price.trim(),
  }));

  if (useDatabase && pool) {
    await ensureMenuTable();
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from menu_items");
      for (const item of sanitized) {
        await client.query(
          "insert into menu_items (name, description, price) values ($1, $2, $3)",
          [item.name, item.description, item.price],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    return sanitized;
  }

  if (isVercel) {
    throw new Error(
      "Menu storage is not configured. Set DATABASE_URL to a Postgres database.",
    );
  }

  const payload = JSON.stringify({ items: sanitized }, null, 2);
  await fs.writeFile(menuPath, payload, "utf-8");
  return sanitized;
};

import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

import menuSeed from "@/data/menu.json";

export type MenuItem = {
  name: string;
  description: string;
  price: string;
  imageUrl?: string;
};

type MenuRow = {
  name: string;
  description: string;
  price: string;
  image_url: string | null;
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
      price text not null,
      image_url text not null default ''
    );
  `);

  await pool.query(`
    alter table menu_items
    add column if not exists image_url text not null default '';
  `);
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeImageUrl = (value: unknown) => {
  const imageUrl = typeof value === "string" ? value.trim() : "";

  if (!imageUrl) {
    return "";
  }

  if (imageUrl.startsWith("/") && !imageUrl.startsWith("//")) {
    return imageUrl;
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  if (/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,/i.test(imageUrl)) {
    return imageUrl;
  }

  return "";
};

const normalizeMenuItem = (item: MenuItem): MenuItem => {
  const imageUrl = normalizeImageUrl(item.imageUrl);
  const sanitized: MenuItem = {
    name: normalizeText(item.name),
    description: normalizeText(item.description),
    price: normalizeText(item.price),
  };

  if (imageUrl) {
    sanitized.imageUrl = imageUrl;
  }

  return sanitized;
};

const mapMenuRow = (row: MenuRow): MenuItem => {
  const item: MenuItem = {
    name: row.name,
    description: row.description,
    price: row.price,
  };

  const imageUrl = normalizeImageUrl(row.image_url);
  if (imageUrl) {
    item.imageUrl = imageUrl;
  }

  return item;
};

const isValidItem = (item: MenuItem) =>
  Boolean(normalizeText(item.name)) &&
  Boolean(normalizeText(item.description)) &&
  Boolean(normalizeText(item.price));

export const getMenu = async (): Promise<MenuItem[]> => {
  if (useDatabase && pool) {
    await ensureMenuTable();
    const result = await pool.query<MenuRow>(
      "select name, description, price, image_url from menu_items order by name",
    );
    return result.rows.map(mapMenuRow);
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
  const sanitized = items.filter(isValidItem).map(normalizeMenuItem);

  if (useDatabase && pool) {
    await ensureMenuTable();
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from menu_items");
      for (const item of sanitized) {
        await client.query(
          `insert into menu_items (name, description, price, image_url)
           values ($1, $2, $3, $4)`,
          [item.name, item.description, item.price, item.imageUrl ?? ""],
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

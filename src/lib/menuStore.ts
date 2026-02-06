import "server-only";

import { promises as fs } from "fs";
import path from "path";

export type MenuItem = {
  name: string;
  description: string;
  price: string;
};

const menuPath = path.join(process.cwd(), "src", "data", "menu.json");

const isValidItem = (item: MenuItem) =>
  Boolean(item.name?.trim()) &&
  Boolean(item.description?.trim()) &&
  Boolean(item.price?.trim());

export const getMenu = async (): Promise<MenuItem[]> => {
  try {
    const file = await fs.readFile(menuPath, "utf-8");
    const data = JSON.parse(file) as { items?: MenuItem[] };
    if (Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  } catch {
    return [];
  }
};

export const updateMenu = async (items: MenuItem[]): Promise<MenuItem[]> => {
  const sanitized = items.filter(isValidItem).map((item) => ({
    name: item.name.trim(),
    description: item.description.trim(),
    price: item.price.trim(),
  }));

  const payload = JSON.stringify({ items: sanitized }, null, 2);
  await fs.writeFile(menuPath, payload, "utf-8");
  return sanitized;
};

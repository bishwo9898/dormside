export type MenuItem = {
  name: string;
  description: string;
  price: string;
  imageUrl?: string;
};

export type CartItem = MenuItem & { quantity: number };
export type Fulfillment = "pickup" | "delivery";

export const parsePrice = (price: string) =>
  Number(price.replace(/[^0-9.]/g, "")) || 0;
export const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );

// Only the original dishes receive illustrative imagery. Admin-uploaded photos take priority.
const dishImages: Record<string, string> = {
  "Cheeseburger Sliders Tray (12 pcs)": "sharing-spread",
  "Buffalo Wings Platter (20 pcs)": "wings",
  "Large Loaded Nacho Tray": "nachos",
  "Mac & Cheese Catering Pan": "mac-cheese",
  "Caesar Salad Bowl": "salad",
  "Assorted Soft Drinks Pack": "drinks",
  "Chocolate Chip Cookie Box": "cookies",
};

export const itemImage = (item: MenuItem) =>
  item.imageUrl?.trim() ||
  (dishImages[item.name] ? `/images/${dishImages[item.name]}.webp` : undefined);
export const itemCategory = (item: MenuItem) => {
  const name = item.name.toLowerCase();
  if (/drink|soda|juice|coffee|tea\b|lemonade/.test(name)) return "Drinks";
  if (/cookie|cake|dessert|brownie|ice cream/.test(name)) return "Sweet treats";
  if (/salad|mac.*cheese|fries|side\b/.test(name)) return "Sides & bowls";
  return "To share";
};

export function parseCart(raw: string | null): CartItem[] {
  try {
    const items: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(items)) return [];
    return items.filter(
      (item): item is CartItem =>
        Boolean(item) &&
        typeof item.name === "string" &&
        typeof item.description === "string" &&
        typeof item.price === "string" &&
        parsePrice(item.price) > 0 &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0 &&
        (item.imageUrl === undefined || typeof item.imageUrl === "string"),
    );
  } catch {
    return [];
  }
}

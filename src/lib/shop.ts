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

// Display only photos explicitly supplied with the menu.
export const itemImage = (item: MenuItem) => item.imageUrl?.trim() || undefined;

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

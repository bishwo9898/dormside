import test from "node:test";
import assert from "node:assert/strict";
import { parseCart, itemImage, money, parsePrice } from "../src/lib/shop.ts";

const item = {
  name: "Cheeseburger Sliders Tray (12 pcs)",
  description: "A tray for sharing.",
  price: "$28",
  quantity: 2,
};

test("a saved bag restores quantities and prices without changing the order", () => {
  const restored = parseCart(JSON.stringify([item]));
  assert.deepEqual(restored, [item]);
  assert.equal(
    money(
      restored.reduce(
        (total, entry) => total + parsePrice(entry.price) * entry.quantity,
        0,
      ),
    ),
    "$56.00",
  );
});

test("corrupt, missing, and non-array storage safely become an empty bag", () => {
  for (const value of [null, "{broken", "null", "42", '{"quantity":1}'])
    assert.deepEqual(parseCart(value), []);
});

test("invalid saved quantities and malformed items cannot enter checkout totals", () => {
  const saved = [
    item,
    null,
    {},
    { ...item, quantity: -1 },
    { ...item, quantity: 0 },
    { ...item, quantity: 1.5 },
    { ...item, quantity: "2" },
    { ...item, price: {} },
    { ...item, imageUrl: {} },
  ];
  assert.deepEqual(parseCart(JSON.stringify(saved)), [item]);
});

test("menu photos are used only when explicitly supplied", () => {
  assert.equal(
    itemImage({ ...item, imageUrl: "/uploads/sliders.jpg" }),
    "/uploads/sliders.jpg",
  );
  assert.equal(itemImage(item), undefined);
  assert.equal(itemImage({ ...item, imageUrl: "   " }), undefined);
  assert.equal(itemImage({ ...item, name: "New kitchen special" }), undefined);
});

test("decimal menu prices and delivery amounts retain currency precision", () => {
  assert.equal(money(parsePrice("$12.50") * 3 + 3 + 2), "$42.50");
});

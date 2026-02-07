import { NextResponse } from "next/server";

import { getStripe } from "@/lib/stripe";
import { getSettings } from "@/lib/settingsStore";

export const runtime = "nodejs";

type CartItem = {
  name: string;
  price: string;
  quantity: number;
};

const parsePrice = (price: string) =>
  Number(price.replace(/[^0-9.]/g, "")) || 0;

export async function POST(request: Request) {
  const settings = await getSettings();
  if (!settings.isOpen) {
    return NextResponse.json({ error: "Orders are closed" }, { status: 403 });
  }

  const body = (await request.json()) as {
    items?: CartItem[];
    deliveryOption?: "pickup" | "delivery";
    tip?: number;
  };

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const deliveryOption =
    body.deliveryOption === "delivery" ? "delivery" : "pickup";
  const deliveryFee = deliveryOption === "delivery" ? 3 : 0;
  const tip = Math.max(0, Number(body.tip ?? 0));

  const amount = body.items.reduce((sum, item) => {
    const lineTotal = parsePrice(item.price) * item.quantity;
    return sum + lineTotal;
  }, 0) + deliveryFee + tip;

  if (amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_source: "dormside",
        fulfillment: deliveryOption,
        tip: tip.toFixed(2),
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

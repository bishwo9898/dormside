import { NextResponse } from "next/server";

import { getOrderById, setOrderPaymentIntent } from "@/lib/orderStore";
import { getSettings } from "@/lib/settingsStore";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const settings = await getSettings();
    if (!settings.isOpen) {
      return NextResponse.json({ error: "Orders are closed" }, { status: 403 });
    }

    const body = (await request.json()) as { orderId?: string };
    if (!body.orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const order = await getOrderById(body.orderId);
    if (!order || order.paymentMethod !== "card" || order.status !== "pending") {
      return NextResponse.json({ error: "This online order can no longer be paid." }, { status: 409 });
    }

    const stripe = getStripe();
    const expectedAmount = Math.round(order.total * 100);
    if (order.paymentIntentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
      if (
        existingIntent.metadata.order_id === order.id &&
        existingIntent.amount === expectedAmount &&
        existingIntent.currency === "usd" &&
        !["canceled", "succeeded"].includes(existingIntent.status)
      ) {
        return NextResponse.json({ clientSecret: existingIntent.client_secret });
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: expectedAmount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        receipt_email: order.customer.email,
        metadata: {
          order_id: order.id,
          order_source: "dormside",
          fulfillment: order.fulfillment,
        },
      },
      { idempotencyKey: `dormside-order-${order.id}` },
    );
    await setOrderPaymentIntent(order.id, paymentIntent.id);

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

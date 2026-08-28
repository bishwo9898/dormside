import { NextResponse } from "next/server";
import Stripe from "stripe";

import { sendOrderEmails } from "@/lib/email";
import { getOrderById, updateOrderEmailStatus, updateOrderStatus } from "@/lib/orderStore";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const markPaidAndEmail = async (orderId: string) => {
  const existing = await getOrderById(orderId);
  if (!existing || existing.paymentMethod !== "card") return;

  const wasAlreadyPaid = existing.status === "paid";
  const order = wasAlreadyPaid ? existing : await updateOrderStatus(orderId, "paid");
  if (!order || wasAlreadyPaid || order.emailStatus === "sent") return;

  try {
    await sendOrderEmails(order);
    await updateOrderEmailStatus(order.id, "sent");
  } catch (error) {
    await updateOrderEmailStatus(order.id, "failed");
    console.error("Failed to send order emails from Stripe webhook", { orderId, error });
  }
};

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Stripe webhook received without STRIPE_WEBHOOK_SECRET configured");
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata.order_id;
    if (orderId) await markPaidAndEmail(orderId);
  }

  return NextResponse.json({ received: true });
}

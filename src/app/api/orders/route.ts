import { NextResponse } from "next/server";

import {
  createOrder,
  deleteOrder,
  getOrderById,
  listOrders,
  convertOrderToCash,
  updateOrderEmailStatus,
  updateOrderStatus,
} from "@/lib/orderStore";
import { getSettings } from "@/lib/settingsStore";
import { sendOrderEmails } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { validateOrder } from "@/lib/orderValidation";

export const runtime = "nodejs";

type OrderRequest = {
  fulfillment?: "pickup" | "delivery";
  paymentMethod: "cash" | "card";
  tip?: number;
  items?: Array<{ name: string; quantity: number }>;
  customer?: { name: string; email: string; phone: string; address: string };
};

const deliverOrderEmail = async (order: Awaited<ReturnType<typeof getOrderById>>) => {
  if (!order || order.emailStatus === "sent") return true;
  try {
    await sendOrderEmails(order);
    await updateOrderEmailStatus(order.id, "sent");
    return true;
  } catch (error) {
    await updateOrderEmailStatus(order.id, "failed");
    console.error("Failed to send order emails", { orderId: order.id, error });
    return false;
  }
};

export async function GET() {
  const orders = await listOrders();
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  try {
    const settings = await getSettings();
    if (!settings.isOpen) {
      return NextResponse.json(
        { error: "Orders are closed" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as OrderRequest;

    if (body.paymentMethod !== "cash" && body.paymentMethod !== "card") {
      return NextResponse.json({ error: "Choose a payment method" }, { status: 400 });
    }
    const validated = await validateOrder(body);

    const record = await createOrder({
      ...validated,
      paymentMethod: body.paymentMethod,
      status: body.paymentMethod === "cash" ? "cash_pending" : "pending",
      emailStatus: "pending",
    });

    let emailSent = false;
    if (record.paymentMethod === "cash") {
      emailSent = await deliverOrderEmail(record);
    }

    return NextResponse.json({ order: record, emailSent });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      status?: "paid";
      paymentIntentId?: string;
      action?: "fallback_to_cash";
    };
    if (!body.id || (!body.status && body.action !== "fallback_to_cash")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const existing = await getOrderById(body.id);
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (body.action === "fallback_to_cash") {
      if (existing.paymentMethod !== "card" || existing.status !== "pending") {
        return NextResponse.json({ error: "This order cannot be changed to cash." }, { status: 409 });
      }
      if (existing.paymentIntentId) {
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.retrieve(existing.paymentIntentId);
        if (intent.status === "succeeded") {
          return NextResponse.json({ error: "Your card payment already succeeded, so this order cannot be changed to cash." }, { status: 409 });
        }
        if (intent.status === "processing") {
          return NextResponse.json({ error: "Your card payment is still processing. Please wait for confirmation before changing payment methods." }, { status: 409 });
        }
        if (intent.status !== "canceled") {
          await stripe.paymentIntents.cancel(intent.id);
        }
      }
      const cashOrder = await convertOrderToCash(existing.id);
      if (!cashOrder) {
        return NextResponse.json({ error: "This order could not be changed to cash." }, { status: 409 });
      }
      const emailSent = await deliverOrderEmail(cashOrder);
      return NextResponse.json({ order: cashOrder, emailSent });
    }

    if (body.status === "paid" && existing.paymentMethod === "card") {
      if (!body.paymentIntentId) {
        return NextResponse.json(
          { error: "Payment verification required" },
          { status: 400 },
        );
      }

      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(body.paymentIntentId);
      const expectedAmount = Math.round(existing.total * 100);
      
      // Only accept succeeded status. Processing should be handled client-side with retries
      if (intent.status !== "succeeded") {
        return NextResponse.json(
          {
            error: `Payment status is ${intent.status}. Please try again in a moment.`,
            status: intent.status,
          },
          { status: 402 },
        );
      }
      
      if (intent.amount !== expectedAmount || intent.currency !== "usd") {
        return NextResponse.json(
          {
            error: "Payment amount verification failed",
          },
          { status: 402 },
        );
      }
      if (intent.metadata.order_id !== existing.id) {
        return NextResponse.json({ error: "Payment does not belong to this order" }, { status: 402 });
      }
    }

    const wasAlreadyPaid = existing.status === "paid";
    const updated = await updateOrderStatus(body.id, "paid");

    if (!updated) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let emailSent = updated.emailStatus === "sent";
    if (!wasAlreadyPaid && updated.status === "paid" && updated.paymentMethod === "card") {
      emailSent = await deliverOrderEmail(updated);
    }

    return NextResponse.json({ order: updated, emailSent });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const removed = await deleteOrder(body.id);
    return NextResponse.json({ removed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

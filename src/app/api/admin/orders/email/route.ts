import { NextResponse } from "next/server";

import { sendOrderEmails } from "@/lib/email";
import { getOrderById, updateOrderEmailStatus } from "@/lib/orderStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    const order = await getOrderById(body.id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    await sendOrderEmails(order);
    await updateOrderEmailStatus(order.id, "sent");
    return NextResponse.json({ sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send the order email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

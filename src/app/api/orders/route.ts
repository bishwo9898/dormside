import { NextResponse } from "next/server";

import {
  createOrder,
  deleteOrder,
  listOrders,
  updateOrderStatus,
} from "@/lib/orderStore";

type OrderRequest = {
  fulfillment: "pickup" | "delivery";
  paymentMethod: "cash" | "card";
  tip: number;
  deliveryFee: number;
  total: number;
  items: Array<{ name: string; price: string; quantity: number }>;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  status?: "pending" | "paid" | "cash_pending";
};

export async function GET() {
  const orders = await listOrders();
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const body = (await request.json()) as OrderRequest;

  if (!body.customer?.name || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  const record = await createOrder({
    ...body,
    status: body.status ?? "pending",
  });

  return NextResponse.json({ order: record });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id?: string; status?: "pending" | "paid" | "cash_pending" };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updated = await updateOrderStatus(body.id, body.status);
  if (!updated) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order: updated });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const removed = await deleteOrder(body.id);
  return NextResponse.json({ removed });
}

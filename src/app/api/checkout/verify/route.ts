import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      paymentIntentId?: string;
    };

    if (!body.paymentIntentId) {
      return NextResponse.json(
        { error: "Payment intent ID required" },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(body.paymentIntentId);

    return NextResponse.json({
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to verify payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

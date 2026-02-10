"use client";
import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

export default function CheckoutSuccessPage() {
  const [message, setMessage] = useState("Checking payment status...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const method = params.get("method");
    const fulfillment = params.get("fulfillment");
    const redirectStatus = params.get("redirect_status");
    const paymentIntentParam = params.get("payment_intent");
    if (method === "cash") {
      setMessage(
        fulfillment === "delivery"
          ? "Order placed! We’ll deliver your food soon."
          : "Order placed! Please pick up at Pearl Hall and pay with cash.",
      );
      return;
    }

    if (redirectStatus === "failed" || redirectStatus === "canceled") {
      setMessage(
        "Payment was not completed. Please return to checkout to try again.",
      );
      return;
    }

    const finalize = async () => {
      const orderId = localStorage.getItem("dormside_order_id");
      const storedIntent = localStorage.getItem("dormside_payment_intent");
      const paymentIntentId = paymentIntentParam || storedIntent;
      if (!orderId) {
        setMessage("We couldn’t locate your order. Please return to checkout.");
        return;
      }

      if (!paymentIntentId) {
        setMessage(
          "We couldn’t verify your payment. Please return to checkout.",
        );
        return;
      }

      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          status: "paid",
          paymentIntentId,
        }),
      });

      if (!response.ok) {
        setMessage(
          "Payment not confirmed. Please return to checkout to try again.",
        );
        return;
      }

      localStorage.removeItem("dormside_cart");
      localStorage.removeItem("dormside_order_id");
      localStorage.removeItem("dormside_payment_intent");
      setMessage("Payment confirmed. We’re preparing your order now.");
    };

    finalize();
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-zinc-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 sm:px-10">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">
            Order update
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-emerald-900">
            Thanks for your order!
          </h1>
          <p className="mt-3 text-sm">{message}</p>
        </div>
        <a
          href="/"
          className="text-sm font-semibold text-zinc-600 transition hover:text-zinc-900"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}

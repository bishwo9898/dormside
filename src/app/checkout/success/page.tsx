"use client";
import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

const MAX_RETRIES = 8;

export default function CheckoutSuccessPage() {
  const [message, setMessage] = useState("Checking payment status...");
  const [status, setStatus] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const method = params.get("method");
    const fulfillment = params.get("fulfillment");
    const redirectStatus = params.get("redirect_status");
    const paymentIntentParam = params.get("payment_intent");

    if (method === "cash") {
      setStatus("success");
      setMessage(
        fulfillment === "delivery"
          ? "Order placed! We'll deliver your food soon."
          : "Order placed! Please pick up at Pearl Hall and pay with cash.",
      );
      return;
    }

    if (redirectStatus === "failed" || redirectStatus === "canceled") {
      setStatus("error");
      setMessage(
        "Payment was not completed. Please return to checkout to try again.",
      );
      return;
    }

    let retryCount = 0;

    const finalize = async (): Promise<void> => {
      const orderId = localStorage.getItem("dormside_order_id");
      const storedIntent = localStorage.getItem("dormside_payment_intent");
      const paymentIntentId = paymentIntentParam || storedIntent;

      if (!orderId) {
        setStatus("error");
        setMessage("We couldn't locate your order. Please return to checkout.");
        return;
      }

      if (!paymentIntentId) {
        setStatus("error");
        setMessage(
          "We couldn't verify your payment. Please return to checkout.",
        );
        return;
      }

      try {
        // First, verify the payment intent status with Stripe
        const verifyResponse = await fetch("/api/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId }),
        });

        if (!verifyResponse.ok) {
          setStatus("error");
          setMessage(
            "Unable to verify payment status. Please return to checkout to try again.",
          );
          return;
        }

        const verifyData = (await verifyResponse.json()) as {
          status?: string;
          error?: string;
        };

        // If payment is still processing, retry after a short delay
        if (verifyData.status === "processing") {
          retryCount++;
          if (retryCount > MAX_RETRIES) {
            // After max retries, show processing message
            setStatus("info");
            setMessage(
              "Your payment is being finalized. It may take a few moments. We'll send you an email confirmation shortly.",
            );
            return;
          }
          setStatus("info");
          setMessage(
            "Your payment is being processed. This usually takes a few seconds. Please don't close this page.",
          );
          // Retry after 2 seconds for processing payments
          setTimeout(() => finalize(), 2000);
          return;
        }

        // If payment is not succeeded yet, show error
        if (verifyData.status !== "succeeded") {
          setStatus("error");
          setMessage(
            "Payment was not completed. Please return to checkout to try again.",
          );
          return;
        }

        // Payment is confirmed as succeeded, now update the order
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
          const errorData = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setStatus("error");
          setMessage(
            errorData?.error ||
              "Payment not confirmed. Please return to checkout to try again.",
          );
          return;
        }

        localStorage.removeItem("dormside_cart");
        localStorage.removeItem("dormside_order_id");
        localStorage.removeItem("dormside_payment_intent");
        setStatus("success");
        setMessage("Payment confirmed. We're preparing your order now.");
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unable to verify payment. Please try again.";
        setStatus("error");
        setMessage(errorMessage);
      }
    };

    finalize();
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-zinc-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 sm:px-10">
        <div
          className={`rounded-3xl border p-6 text-sm ${
            status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">
            {status === "error"
              ? "Payment issue"
              : status === "success"
                ? "Order update"
                : "Payment status"}
          </p>
          <h1
            className={`mt-2 text-3xl font-semibold ${
              status === "error"
                ? "text-red-900"
                : status === "success"
                  ? "text-emerald-900"
                  : "text-amber-900"
            }`}
          >
            {status === "error"
              ? "Payment not completed"
              : status === "success"
                ? "Thanks for your order!"
                : "Checking payment"}
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

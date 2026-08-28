"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

const MAX_RETRIES = 8;

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Checking payment status...");
  const [status, setStatus] = useState<"success" | "error" | "info">("info");
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [cashFallbackOrderId, setCashFallbackOrderId] = useState<string | null>(null);
  const [isSwitchingToCash, setIsSwitchingToCash] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const method = params.get("method");
    const fulfillment = params.get("fulfillment");
    const redirectStatus = params.get("redirect_status");
    const paymentIntentParam = params.get("payment_intent");
    const orderParam = params.get("order_id");
    const emailStatus = params.get("email");

    if (method === "cash") {
      if (orderParam) {
        setReceiptOrderId(orderParam);
      }
      setStatus("success");
      setMessage(
        fulfillment === "delivery"
          ? `Order placed! We'll deliver your food soon.${emailStatus === "pending" ? " We’re still sending your confirmation email." : ""}`
          : `Order placed! Please pick up at Pearl Hall and pay with cash.${emailStatus === "pending" ? " We’re still sending your confirmation email." : ""}`,
      );
      return;
    }

    if (redirectStatus === "failed" || redirectStatus === "canceled") {
      setStatus("error");
      setCashFallbackOrderId(orderParam || localStorage.getItem("dormside_order_id"));
      setMessage(
        "Payment was not completed. Please return to checkout to try again.",
      );
      return;
    }

    let retryCount = 0;

    const finalize = async (): Promise<void> => {
      const orderId = orderParam || localStorage.getItem("dormside_order_id");
      const storedIntent = localStorage.getItem("dormside_payment_intent");
      const paymentIntentId = paymentIntentParam || storedIntent;

      if (!orderId) {
        setStatus("error");
        setMessage("We couldn't locate your order. Please return to checkout.");
        return;
      }
      setCashFallbackOrderId(orderId);

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
          setCashFallbackOrderId(orderId);
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
          setCashFallbackOrderId(orderId);
          setMessage(
            errorData?.error ||
              "Payment not confirmed. Please return to checkout to try again.",
          );
          return;
        }

        const orderData = (await response.json()) as {
          order?: { id?: string };
        };
        setReceiptOrderId(orderData.order?.id ?? orderId);
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

  const payCashInstead = async () => {
    if (!cashFallbackOrderId) return;
    setIsSwitchingToCash(true);
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cashFallbackOrderId, action: "fallback_to_cash" }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; emailSent?: boolean } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to switch to cash payment.");
      localStorage.removeItem("dormside_cart");
      localStorage.removeItem("dormside_order_id");
      localStorage.removeItem("dormside_payment_intent");
      router.replace(`/checkout/success?method=cash&order_id=${encodeURIComponent(cashFallbackOrderId)}&email=${data?.emailSent ? "sent" : "pending"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to switch to cash payment.");
    } finally {
      setIsSwitchingToCash(false);
    }
  };

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

        {status === "success" && receiptOrderId && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Receipt
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
              Your receipt is ready
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Download a professional PDF receipt with your order details,
              pricing, payment status, and fulfillment information.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href={`/api/orders/${encodeURIComponent(receiptOrderId)}/receipt`}
                download
                className="rounded-full bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-zinc-900/15 transition hover:bg-zinc-800"
              >
                Download PDF receipt
              </a>
              <a
                href={`/api/orders/${encodeURIComponent(
                  receiptOrderId,
                )}/receipt?format=html`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-zinc-200 bg-white px-5 py-3 text-center text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                Open printable copy
              </a>
            </div>
          </div>
        )}
        {status === "error" && cashFallbackOrderId && (
          <button
            onClick={() => void payCashInstead()}
            disabled={isSwitchingToCash}
            className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSwitchingToCash ? "Switching to cash..." : "Pay in cash or in person instead"}
          </button>
        )}
        <Link
          href="/"
          className="text-sm font-semibold text-zinc-600 transition hover:text-zinc-900"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

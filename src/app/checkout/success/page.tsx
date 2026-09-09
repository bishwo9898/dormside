"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand, Icon } from "@/components/shop-ui";
import { clearCart } from "@/components/use-cart";

const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const dynamic = "force-dynamic";

const MAX_RETRIES = 8;

export default function CheckoutSuccessPage() {
  const [message, setMessage] = useState("Checking payment status...");
  const [status, setStatus] = useState<"success" | "error" | "info">("info");
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const method = params.get("method");
    const fulfillment = params.get("fulfillment");
    const redirectStatus = params.get("redirect_status");
    const paymentIntentParam = params.get("payment_intent");
    const orderParam = params.get("order_id");

    if (method === "cash") {
      if (orderParam) {
        setReceiptOrderId(orderParam);
      }
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
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const finalize = async (): Promise<void> => {
      if (!active) return;
      const orderId = orderParam || readStored("dormside_order_id");
      const storedIntent = readStored("dormside_payment_intent");
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

        if (!active) return;
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
          retryTimer = setTimeout(() => void finalize(), 2000);
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

        if (!active) return;
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

        const orderData = (await response.json()) as {
          order?: { id?: string };
        };
        setReceiptOrderId(orderData.order?.id ?? orderId);
        clearCart();
        try {
          localStorage.removeItem("dormside_order_id");
          localStorage.removeItem("dormside_payment_intent");
        } catch {
          /* Payment confirmation does not depend on storage access. */
        }
        setStatus("success");
        setMessage("Payment confirmed. We're preparing your order now.");
      } catch (error) {
        if (!active) return;
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unable to verify payment. Please try again.";
        setStatus("error");
        setMessage(errorMessage);
      }
    };

    void finalize();
    return () => {
      active = false;
      clearTimeout(retryTimer);
    };
  }, []);

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <div className="shell">
          <Brand />
          <Link href="/#menu" className="checkout-back">
            <Icon name="back" size={17} /> Back to the menu
          </Link>
        </div>
      </header>
      <main className="success-shell">
        <div className={`success-icon ${status}`}>
          <Icon
            name={
              status === "success"
                ? "check"
                : status === "error"
                  ? "close"
                  : "clock"
            }
            size={35}
          />
        </div>
        <p className="eyebrow">
          {status === "success"
            ? "GOOD FOOD IS ON THE WAY"
            : status === "error"
              ? "LET’S GET THIS SORTED"
              : "JUST A MOMENT"}
        </p>
        <h1>
          {status === "success"
            ? "Thanks for your order!"
            : status === "error"
              ? "A little hiccup."
              : "Checking your payment."}
        </h1>
        <p
          className="success-message"
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
        {status === "success" && receiptOrderId && (
          <section className="checkout-panel success-receipt">
            <h2>All the details, right here.</h2>
            <p>
              Keep a copy of your order, payment details, and pickup or delivery
              information.
            </p>
            <div className="receipt-actions">
              <a
                href={`/api/orders/${encodeURIComponent(receiptOrderId)}/receipt`}
                download
                className="primary-button"
              >
                Download your receipt <Icon name="arrow" size={17} />
              </a>
              <a
                href={`/api/orders/${encodeURIComponent(receiptOrderId)}/receipt?format=html`}
                target="_blank"
                rel="noreferrer"
                className="text-button"
              >
                Open a printable copy <Icon name="arrow" size={15} />
              </a>
            </div>
          </section>
        )}
        <Link
          href={status === "error" ? "/checkout" : "/#menu"}
          className="text-button"
        >
          {status === "error" ? "Return to checkout" : "Back to the good stuff"}
          <Icon name="arrow" size={17} />
        </Link>
      </main>
    </div>
  );
}

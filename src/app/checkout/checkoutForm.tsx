"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

type BillingDetails = {
  name: string;
  email: string;
  phone: string;
};

type CheckoutFormProps = {
  disabled: boolean;
  billingDetails: BillingDetails;
  orderId: string | null;
  onPayCashInstead: () => void | Promise<void>;
};

export default function CheckoutForm({
  disabled,
  billingDetails,
  orderId,
  onPayCashInstead,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSucceeded, setHasSucceeded] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements || hasSucceeded) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    localStorage.removeItem("dormside_payment_intent");

    const getSuccessPath = (paymentIntentId?: string) => {
      const params = new URLSearchParams();
      if (paymentIntentId) {
        params.set("payment_intent", paymentIntentId);
      }
      if (orderId) {
        params.set("order_id", orderId);
      }
      const query = params.toString();
      return `/checkout/success${query ? `?${query}` : ""}`;
    };

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: new URL(getSuccessPath(), window.location.origin).toString(),
        payment_method_data: {
          billing_details: {
            name: billingDetails.name,
            email: billingDetails.email,
            phone: billingDetails.phone,
          },
        },
      },
      redirect: "if_required",
    });
    const paymentIntentId = result.paymentIntent?.id;

    if (result.error) {
      if (paymentIntentId) {
        localStorage.setItem("dormside_payment_intent", paymentIntentId);
      }
      if (result.error.code === "payment_intent_unexpected_state") {
        setHasSucceeded(true);
        router.push(getSuccessPath(paymentIntentId));
        return;
      }
      setMessage(result.error.message ?? "Payment failed. Please try again.");
    } else if (
      result.paymentIntent?.status === "succeeded" ||
      result.paymentIntent?.status === "processing"
    ) {
      setHasSucceeded(true);
      if (paymentIntentId) {
        localStorage.setItem("dormside_payment_intent", paymentIntentId);
      }
      router.push(getSuccessPath(paymentIntentId));
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <PaymentElement />
      {message && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          <p>{message}</p>
          <button
            type="button"
            onClick={() => void onPayCashInstead()}
            disabled={isSubmitting}
            className="mt-3 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Pay in cash or in person instead
          </button>
        </div>
      )}
      <button
        disabled={!stripe || isSubmitting || disabled || hasSucceeded}
        className="mt-6 w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Processing..." : "Pay now"}
      </button>
    </form>
  );
}

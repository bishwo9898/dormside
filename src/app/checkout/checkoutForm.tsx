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
};

export default function CheckoutForm({
  disabled,
  billingDetails,
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

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
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

    if (error) {
      if (error.code === "payment_intent_unexpected_state") {
        setHasSucceeded(true);
        router.push("/checkout/success");
        return;
      }
      setMessage(error.message ?? "Payment failed. Please try again.");
    } else if (
      paymentIntent?.status === "succeeded" ||
      paymentIntent?.status === "processing"
    ) {
      setHasSucceeded(true);
      router.push("/checkout/success");
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
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
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

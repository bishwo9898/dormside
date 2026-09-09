"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Icon } from "@/components/shop-ui";
import { money } from "@/lib/shop";

type CheckoutFormProps = {
  disabled: boolean;
  billingDetails: { name: string; email: string; phone: string };
  orderId: string | null;
  total: number;
  onSubmittingChange: (busy: boolean) => void;
};

export default function CheckoutForm({
  disabled,
  billingDetails,
  orderId,
  total,
  onSubmittingChange,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSucceeded, setHasSucceeded] = useState(false);
  const submitting = useRef(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !stripe ||
      !elements ||
      hasSucceeded ||
      disabled ||
      submitting.current ||
      !orderId
    )
      return;
    submitting.current = true;
    setIsSubmitting(true);
    onSubmittingChange(true);
    setMessage(null);
    const getSuccessPath = (paymentIntentId?: string) => {
      const params = new URLSearchParams({ order_id: orderId });
      if (paymentIntentId) params.set("payment_intent", paymentIntentId);
      return `/checkout/success?${params}`;
    };
    try {
      try {
        localStorage.removeItem("dormside_payment_intent");
      } catch {
        /* IDs are included in the return URL. */
      }
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: new URL(
            getSuccessPath(),
            window.location.origin,
          ).toString(),
          payment_method_data: { billing_details: billingDetails },
        },
        redirect: "if_required",
      });
      const paymentIntentId = result.paymentIntent?.id;
      if (paymentIntentId) {
        try {
          localStorage.setItem("dormside_payment_intent", paymentIntentId);
        } catch {
          /* IDs are included in the return URL. */
        }
      }
      if (
        result.paymentIntent?.status === "succeeded" ||
        result.paymentIntent?.status === "processing" ||
        result.error?.code === "payment_intent_unexpected_state"
      ) {
        setHasSucceeded(true);
        router.push(getSuccessPath(paymentIntentId));
        return;
      }
      setMessage(
        result.error?.message ??
          "Payment wasn’t completed. Please check your details and try again.",
      );
    } catch {
      setMessage(
        "We couldn’t confirm the payment. Please check your connection and try again.",
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
      onSubmittingChange(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {message && (
        <div className="checkout-error" role="alert">
          {message}
        </div>
      )}
      <button
        disabled={
          !stripe ||
          !elements ||
          isSubmitting ||
          disabled ||
          hasSucceeded ||
          !orderId
        }
        className="primary-button"
      >
        {hasSucceeded
          ? "Payment received"
          : isSubmitting
            ? "Processing payment…"
            : `Pay ${money(total)}`}
        <Icon name="lock" size={16} />
      </button>
    </form>
  );
}

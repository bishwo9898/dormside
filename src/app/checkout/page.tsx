"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import CheckoutForm from "@/app/checkout/checkoutForm";

type CartItem = {
  name: string;
  description: string;
  price: string;
  imageUrl?: string;
  quantity: number;
};

type Fulfillment = "pickup" | "delivery";

type PaymentMethod = "cash" | "card";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const parsePrice = (price: string) =>
  Number(price.replace(/[^0-9.]/g, "")) || 0;

const getItemInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "DS";

function CartItemPhoto({ item }: { item: CartItem }) {
  const imageUrl = item.imageUrl?.trim();
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const shouldShowImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;

  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#eef2f7]">
      {shouldShowImage ? (
        <img
          src={imageUrl}
          alt={item.name}
          className="h-full w-full object-cover"
          onError={() => setFailedImageUrl(imageUrl ?? null)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#fee2c7] via-[#e6eefc] to-[#d8f4ef] text-sm font-semibold text-zinc-700">
          {getItemInitials(item.name)}
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingOnlineOrder, setIsCreatingOnlineOrder] = useState(false);
  const [isPlacingCashOrder, setIsPlacingCashOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [tipInput, setTipInput] = useState<string>("");
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
    address: false,
  });
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const cashSubmissionInFlight = useRef(false);
  const onlineSubmissionInFlight = useRef(false);

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + parsePrice(item.price) * item.quantity,
        0,
      ),
    [cartItems],
  );

  const deliveryFee = fulfillment === "delivery" ? 3 : 0;
  const parsedTip = Number(tipInput || 0);
  const tipAmount = Number.isFinite(parsedTip) ? Math.max(0, parsedTip) : 0;
  const total = subtotal + deliveryFee + tipAmount;

  useEffect(() => {
    const stored = localStorage.getItem("dormside_cart");
    if (stored) {
      try {
        setCartItems(JSON.parse(stored) as CartItem[]);
      } catch {
        localStorage.removeItem("dormside_cart");
      }
    }
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const data = (await response.json()) as { isOpen?: boolean };
        setIsOpen(data.isOpen ?? true);
      } catch {
        setIsOpen(true);
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const storedMethod = localStorage.getItem("dormside_payment_method");
    if (storedMethod === "cash" || storedMethod === "card") {
      setPaymentMethod(storedMethod);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("dormside_payment_method", paymentMethod);
  }, [paymentMethod]);

  const emailValid =
    customerInfo.email.trim().length > 3 && customerInfo.email.includes("@");
  const nameValid = customerInfo.name.trim().length > 1;
  const phoneDigits = customerInfo.phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 7;
  const addressValid =
    fulfillment === "pickup" || customerInfo.address.trim().length > 3;

  const isFormValid =
    nameValid &&
    emailValid &&
    phoneValid &&
    addressValid &&
    cartItems.length > 0;

  useEffect(() => {
    if (!publishableKey) {
      setError("Online payment is unavailable right now. You can still place a cash order.");
    }
    setIsLoading(false);
  }, []);

  const handleInfoChange = (
    field: keyof typeof customerInfo,
    value: string,
  ) => {
    setCustomerInfo((prev) => ({ ...prev, [field]: value }));
  };

  const markTouched = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handlePlaceCashOrder = () => {
    setSubmitAttempted(true);
    if (!isFormValid || !isOpen) {
      return;
    }
    const createCashOrder = async () => {
      if (cashSubmissionInFlight.current) return;
      cashSubmissionInFlight.current = true;
      setIsPlacingCashOrder(true);
      setOrderMessage(null);
      try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillment,
          paymentMethod: "cash",
          tip: tipAmount,
          items: cartItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
          })),
          customer: {
            ...customerInfo,
            address: fulfillment === "delivery" ? customerInfo.address : "",
          },
          status: "cash_pending",
        }),
      });

      if (!response.ok) {
        const orderError = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setOrderMessage(
          orderError?.error ?? "Unable to place cash order. Please try again.",
        );
        return;
      }

      const orderData = (await response.json()) as {
        order?: { id?: string };
        emailSent?: boolean;
      };
      const receiptParam = orderData.order?.id
        ? `&order_id=${encodeURIComponent(orderData.order.id)}`
        : "";

      setOrderMessage(
        fulfillment === "delivery"
          ? "Order placed! We’ll deliver your food soon."
          : "Order placed! Please pick up at Pearl Hall and pay with cash.",
      );
      localStorage.removeItem("dormside_cart");
      localStorage.removeItem("dormside_order_id");
      setCartItems([]);
      router.push(
        `/checkout/success?method=cash&fulfillment=${fulfillment}${receiptParam}&email=${orderData.emailSent ? "sent" : "pending"}`,
      );
      } catch {
        setOrderMessage("Unable to place cash order. Please check your connection and try again.");
      } finally {
        cashSubmissionInFlight.current = false;
        setIsPlacingCashOrder(false);
      }
    };

    createCashOrder();
  };

  const handleStartOnlinePayment = async () => {
    setSubmitAttempted(true);
    if (!isFormValid || !isOpen || !publishableKey) return;
    if (onlineSubmissionInFlight.current) return;
    onlineSubmissionInFlight.current = true;
    setIsCreatingOnlineOrder(true);
    setError(null);
    try {
      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillment,
          paymentMethod: "card",
          tip: tipAmount,
          items: cartItems.map((item) => ({ name: item.name, quantity: item.quantity })),
          customer: { ...customerInfo, address: fulfillment === "delivery" ? customerInfo.address : "" },
        }),
      });
      const orderData = (await orderResponse.json().catch(() => null)) as { order?: { id?: string }; error?: string } | null;
      if (!orderResponse.ok || !orderData?.order?.id) throw new Error(orderData?.error ?? "Unable to save your order.");

      const newOrderId = orderData.order.id;
      setOrderId(newOrderId);
      localStorage.setItem("dormside_order_id", newOrderId);
      const checkoutResponse = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: newOrderId }),
      });
      const checkoutData = (await checkoutResponse.json().catch(() => null)) as { clientSecret?: string; error?: string } | null;
      if (!checkoutResponse.ok || !checkoutData?.clientSecret) throw new Error(checkoutData?.error ?? "Unable to start online payment.");
      setClientSecret(checkoutData.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start online payment. Please try again.");
    } finally {
      onlineSubmissionInFlight.current = false;
      setIsCreatingOnlineOrder(false);
    }
  };

  const handleCashFallback = async () => {
    if (!orderId) {
      setPaymentMethod("cash");
      return;
    }
    if (cashSubmissionInFlight.current) return;
    cashSubmissionInFlight.current = true;
    setIsPlacingCashOrder(true);
    setOrderMessage(null);
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, action: "fallback_to_cash" }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; emailSent?: boolean } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to switch to cash payment.");
      localStorage.removeItem("dormside_cart");
      localStorage.removeItem("dormside_order_id");
      localStorage.removeItem("dormside_payment_intent");
      router.push(`/checkout/success?method=cash&fulfillment=${fulfillment}&order_id=${encodeURIComponent(orderId)}&email=${data?.emailSent ? "sent" : "pending"}`);
    } catch (err) {
      setOrderMessage(err instanceof Error ? err.message : "Unable to switch to cash payment.");
    } finally {
      cashSubmissionInFlight.current = false;
      setIsPlacingCashOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-zinc-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 sm:px-10">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Checkout
          </p>
          <h1 className="text-3xl font-semibold">Complete your payment</h1>
          <p className="text-sm text-zinc-600">
            Choose delivery or pickup, add a tip, and pay with cash or card.
          </p>
        </header>

        {!isOpen && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            Orders are closed right now. Please check back soon.
          </div>
        )}

        {cartItems.length === 0 && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Your cart is empty. Please add items before checking out.
          </div>
        )}

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-600">Order total</p>
              <p className="text-lg font-semibold text-zinc-900">
                ${total.toFixed(2)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
              <span>Subtotal: ${subtotal.toFixed(2)}</span>
              <span>Delivery: ${deliveryFee.toFixed(2)}</span>
              <span>Tip: ${tipAmount.toFixed(2)}</span>
            </div>
            {cartItems.length > 0 && (
              <div className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100 pt-3">
                {cartItems.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <CartItemPhoto item={item} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {item.quantity} x {item.price}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-zinc-900">
                      ${(parsePrice(item.price) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">Fulfillment</p>
              <p className="mt-1 text-xs text-zinc-500">
                Pickup is at Pearl Hall. Delivery adds $3.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setFulfillment("pickup")}
                  disabled={Boolean(orderId)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                    fulfillment === "pickup"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <span className="mt-1 block text-xs font-normal text-zinc-500">
                    Ready for pickup at the dining counter.
                  </span>
                </button>
                <button
                  onClick={() => setFulfillment("delivery")}
                  disabled={Boolean(orderId)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                    fulfillment === "delivery"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  Deliver to my place
                  <span className="mt-1 block text-xs font-normal text-zinc-500">
                    $3 delivery fee applied automatically.
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">Your info</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Full name
                  <input
                    value={customerInfo.name}
                    disabled={Boolean(orderId)}
                    onChange={(event) =>
                      handleInfoChange("name", event.target.value)
                    }
                    onBlur={() => markTouched("name")}
                    placeholder="Your name"
                    className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  />
                  {(touched.name || submitAttempted) && !nameValid && (
                    <span className="mt-2 block text-xs text-red-600">
                      Please enter your name.
                    </span>
                  )}
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Phone number
                  <input
                    value={customerInfo.phone}
                    disabled={Boolean(orderId)}
                    onChange={(event) =>
                      handleInfoChange("phone", event.target.value)
                    }
                    onBlur={() => markTouched("phone")}
                    placeholder="(859) 555-0123"
                    className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  />
                  {(touched.phone || submitAttempted) && !phoneValid && (
                    <span className="mt-2 block text-xs text-red-600">
                      Enter a valid phone number.
                    </span>
                  )}
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:col-span-2">
                  Your email
                  <input
                    value={customerInfo.email}
                    disabled={Boolean(orderId)}
                    onChange={(event) =>
                      handleInfoChange("email", event.target.value)
                    }
                    onBlur={() => markTouched("email")}
                    placeholder="you@centre.edu"
                    className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  />
                  {(touched.email || submitAttempted) && !emailValid && (
                    <span className="mt-2 block text-xs text-red-600">
                      Use your @centre.edu email.
                    </span>
                  )}
                </label>
                {fulfillment === "delivery" && (
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:col-span-2">
                    Building and room number
                    <input
                      value={customerInfo.address}
                      disabled={Boolean(orderId)}
                      onChange={(event) =>
                        handleInfoChange("address", event.target.value)
                      }
                      onBlur={() => markTouched("address")}
                      placeholder="Pearl Hall, Room 210"
                      className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                    />
                    {(touched.address || submitAttempted) && !addressValid && (
                      <span className="mt-2 block text-xs text-red-600">
                        Address is required for delivery.
                      </span>
                    )}
                  </label>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">Tip</p>
              <p className="mt-1 text-xs text-zinc-500">
                Optional — 100% goes to your team.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm font-semibold text-zinc-500">$</span>
                <input
                  value={tipInput}
                  disabled={Boolean(orderId)}
                  onChange={(event) => setTipInput(event.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">
                Payment method
              </p>
              <div className="mt-4 grid gap-3">
                <button
                  onClick={() => void handleCashFallback()}
                  disabled={isPlacingCashOrder}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                    paymentMethod === "cash"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  Pay with cash
                  <span className="mt-1 block text-xs font-normal text-zinc-500">
                    Pay at pickup or delivery.
                  </span>
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  disabled={Boolean(orderId)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                    paymentMethod === "card"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  Pay online
                  <span className="mt-1 block text-xs font-normal text-zinc-500">
                    Card, Apple Pay, and supported wallets.
                  </span>
                </button>
              </div>
            </div>

            {paymentMethod === "card" ? (
              isLoading ? (
                <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="h-5 w-40 animate-pulse rounded-full bg-zinc-200" />
                  <div className="mt-4 h-10 w-full animate-pulse rounded-2xl bg-zinc-200" />
                </div>
              ) : clientSecret ? (
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret, appearance: { theme: "stripe" } }}
                >
                  <CheckoutForm
                    disabled={!isFormValid || !isOpen}
                    orderId={orderId}
                    billingDetails={{
                      name: customerInfo.name,
                      email: customerInfo.email,
                      phone: customerInfo.phone,
                    }}
                    onPayCashInstead={handleCashFallback}
                  />
                </Elements>
              ) : (
                <div className={`rounded-3xl border p-6 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-zinc-200 bg-white text-zinc-600"}`}>
                  <p>{error ?? "Complete your info to continue with online payment."}</p>
                  {publishableKey && (
                    <button
                      onClick={() => void handleStartOnlinePayment()}
                      disabled={!isFormValid || !isOpen || isCreatingOnlineOrder}
                      className="mt-4 w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingOnlineOrder ? "Preparing secure payment..." : "Continue to secure payment"}
                    </button>
                  )}
                  {orderId && (
                    <button
                      onClick={() => void handleCashFallback()}
                      disabled={isPlacingCashOrder}
                      className="mt-3 w-full rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPlacingCashOrder ? "Switching to cash..." : "Pay in cash or in person instead"}
                    </button>
                  )}
                </div>
              )
            ) : (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-zinc-600">
                  You’ll pay with cash when your order is delivered or picked
                  up.
                </p>
                <button
                  onClick={handlePlaceCashOrder}
                  disabled={!isFormValid || !isOpen || isPlacingCashOrder}
                  className="mt-4 w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPlacingCashOrder ? "Placing order..." : "Place cash order"}
                </button>
                {!isFormValid && (
                  <p className="mt-3 text-xs text-red-600">
                    Please complete your info before placing the order.
                  </p>
                )}
                {!isOpen && (
                  <p className="mt-3 text-xs text-amber-600">
                    Orders are closed right now.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {orderMessage && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-700">
            {orderMessage}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/#menu"
            className="text-sm font-semibold text-zinc-600 transition hover:text-zinc-900"
          >
            Add more items
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-zinc-600 transition hover:text-zinc-900"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

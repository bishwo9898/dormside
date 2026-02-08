"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import CheckoutForm from "@/app/checkout/checkoutForm";

type CartItem = {
  name: string;
  description: string;
  price: string;
  quantity: number;
};

type Fulfillment = "pickup" | "delivery";

type PaymentMethod = "cash" | "card";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const parsePrice = (price: string) =>
  Number(price.replace(/[^0-9.]/g, "")) || 0;

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      setCartItems(JSON.parse(stored) as CartItem[]);
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
    const storedOrderId = localStorage.getItem("dormside_order_id");
    if (storedOrderId) {
      setOrderId(storedOrderId);
    }
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
    const createIntent = async () => {
      if (!publishableKey) {
        setClientSecret(null);
        setError(
          "Stripe is not configured. Please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in Vercel and redeploy.",
        );
        setIsLoading(false);
        return;
      }

      if (
        cartItems.length === 0 ||
        paymentMethod !== "card" ||
        !isFormValid ||
        !isOpen
      ) {
        setIsLoading(false);
        setClientSecret(null);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cartItems,
            deliveryOption: fulfillment,
            tip: tipAmount,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(errorData?.error ?? "Unable to start checkout");
        }

        const data = (await response.json()) as { clientSecret: string };
        setClientSecret(data.clientSecret);
        setError(null);

        if (!orderId) {
          const orderResponse = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fulfillment,
              paymentMethod: "card",
              tip: tipAmount,
              deliveryFee,
              total,
              items: cartItems.map((item) => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
              })),
              customer: {
                ...customerInfo,
                address: fulfillment === "delivery" ? customerInfo.address : "",
              },
              status: "pending",
            }),
          });

          if (!orderResponse.ok) {
            const orderError = (await orderResponse
              .json()
              .catch(() => null)) as { error?: string } | null;
            throw new Error(orderError?.error ?? "Unable to save order");
          }

          const orderData = (await orderResponse.json()) as {
            order?: { id?: string };
          };
          if (orderData.order?.id) {
            setOrderId(orderData.order.id);
            localStorage.setItem("dormside_order_id", orderData.order.id);
          }
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to start checkout. Please try again.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    createIntent();
  }, [
    cartItems,
    customerInfo,
    deliveryFee,
    fulfillment,
    isFormValid,
    isOpen,
    orderId,
    paymentMethod,
    tipAmount,
    total,
  ]);

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
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillment,
          paymentMethod: "cash",
          tip: tipAmount,
          deliveryFee,
          total,
          items: cartItems.map((item) => ({
            name: item.name,
            price: item.price,
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

      setOrderMessage(
        fulfillment === "delivery"
          ? "Order placed! We’ll deliver your food soon."
          : "Order placed! Please pick up at Pearl Hall and pay with cash.",
      );
      localStorage.removeItem("dormside_cart");
      localStorage.removeItem("dormside_order_id");
      setCartItems([]);
      router.push(`/checkout/success?method=cash&fulfillment=${fulfillment}`);
    };

    createCashOrder();
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
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                    fulfillment === "pickup"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  Pick up at Pearl Hall
                  <span className="mt-1 block text-xs font-normal text-zinc-500">
                    Ready for pickup at the dining counter.
                  </span>
                </button>
                <button
                  onClick={() => setFulfillment("delivery")}
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
                  Your email (Please do not use centre email)
                  <input
                    value={customerInfo.email}
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
                  onClick={() => setPaymentMethod("cash")}
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
              ) : error ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                  {error}
                </div>
              ) : clientSecret ? (
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret, appearance: { theme: "stripe" } }}
                >
                  <CheckoutForm
                    disabled={!isFormValid || !isOpen}
                    billingDetails={{
                      name: customerInfo.name,
                      email: customerInfo.email,
                      phone: customerInfo.phone,
                    }}
                  />
                </Elements>
              ) : (
                <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
                  Complete your info to continue with online payment.
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
                  disabled={!isFormValid || !isOpen}
                  className="mt-4 w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Place cash order
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
          <a
            href="/#menu"
            className="text-sm font-semibold text-zinc-600 transition hover:text-zinc-900"
          >
            Add more items
          </a>
          <a
            href="/"
            className="text-sm font-semibold text-zinc-600 transition hover:text-zinc-900"
          >
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

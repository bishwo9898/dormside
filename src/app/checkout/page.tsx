"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutForm from "@/app/checkout/checkoutForm";
import { Brand, FoodPhoto, Icon } from "@/components/shop-ui";
import { useCart, useHydrated, usePreference } from "@/components/use-cart";
import { money, parsePrice, type Fulfillment } from "@/lib/shop";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
type Customer = { name: string; email: string; phone: string; address: string };

export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { cartItems, setCartItems } = useCart();
  const [savedFulfillment, setFulfillment] = usePreference(
    "dormside_fulfillment",
    "pickup",
  );
  const fulfillment: Fulfillment =
    savedFulfillment === "delivery" ? "delivery" : "pickup";
  const [savedPayment, setPaymentMethod] = usePreference(
    "dormside_payment_method",
    "cash",
  );
  const paymentMethod = savedPayment === "card" ? "card" : "cash";
  const [tipInput, setTipInput] = useState("");
  const [customer, setCustomer] = useState<Customer>({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [touched, setTouched] = useState<
    Partial<Record<keyof Customer, boolean>>
  >({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSession, setPaymentSession] = useState<{
    clientSecret: string;
    orderId: string;
    signature: string;
  } | null>(null);
  const submissionLock = useRef(false);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + parsePrice(item.price) * item.quantity,
    0,
  );
  const deliveryFee = fulfillment === "delivery" ? 3 : 0;
  const tipNumber = Number(tipInput || 0);
  const tipValid =
    Number.isFinite(tipNumber) &&
    tipNumber >= 0 &&
    /^\d*(\.\d{0,2})?$/.test(tipInput);
  const tip = tipValid ? tipNumber : 0;
  const total = subtotal + deliveryFee + tip;
  const errors: Record<keyof Customer, string> = {
    name: customer.name.trim().length > 1 ? "" : "Please enter your full name.",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())
      ? ""
      : "Please enter a valid email address.",
    phone:
      customer.phone.replace(/\D/g, "").length >= 7
        ? ""
        : "Please enter a valid phone number.",
    address:
      fulfillment === "pickup" || customer.address.trim().length > 3
        ? ""
        : "Please enter your building and room number.",
  };
  const valid =
    !Object.values(errors).some(Boolean) && tipValid && cartItems.length > 0;
  const orderPayload = {
    fulfillment,
    paymentMethod,
    tip,
    deliveryFee,
    total,
    items: cartItems.map(({ name, price, quantity }) => ({
      name,
      price,
      quantity,
    })),
    customer: {
      name: customer.name.trim(),
      email: customer.email.trim(),
      phone: customer.phone.trim(),
      address: fulfillment === "delivery" ? customer.address.trim() : "",
    },
    status: paymentMethod === "cash" ? "cash_pending" : "pending",
  };
  const signature = JSON.stringify(orderPayload);
  const sessionCurrent = paymentSession?.signature === signature;
  const locked = submitting || (Boolean(paymentSession) && sessionCurrent);

  useEffect(() => {
    const controller = new AbortController();
    const loadStatus = async () => {
      try {
        const response = await fetch("/api/settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Status unavailable");
        const data = await response.json();
        if (!controller.signal.aborted)
          setIsOpen(typeof data.isOpen === "boolean" ? data.isOpen : null);
      } catch {
        if (!controller.signal.aborted) setIsOpen(null);
      }
    };
    void loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const submit = async () => {
    setSubmitAttempted(true);
    setError(null);
    if (!valid) {
      const firstInvalid = (Object.keys(errors) as (keyof Customer)[]).find(
        (key) => errors[key],
      );
      if (!firstInvalid)
        document.getElementById("tip-details")?.setAttribute("open", "");
      document
        .getElementById(firstInvalid ? `customer-${firstInvalid}` : "tip-input")
        ?.focus();
      return;
    }
    if (isOpen !== true || submissionLock.current) return;
    if (paymentMethod === "card" && !stripePromise) {
      setError(
        "Online payment is currently unavailable. Please choose cash to continue.",
      );
      return;
    }
    submissionLock.current = true;
    setSubmitting(true);
    try {
      let clientSecret: string | undefined;
      if (paymentMethod === "card") {
        const intentResponse = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cartItems,
            deliveryOption: fulfillment,
            tip,
          }),
        });
        const intent = await intentResponse.json();
        if (!intentResponse.ok || !intent.clientSecret)
          throw new Error(
            intent.error ||
              "Online payment couldn’t start. Please try again or choose cash.",
          );
        clientSecret = intent.clientSecret;
      }
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: signature,
      });
      const data = await response.json();
      if (!response.ok || !data.order?.id)
        throw new Error(
          data.error || "Your order couldn’t be placed. Please try again.",
        );
      const orderId = data.order.id as string;
      if (paymentMethod === "cash") {
        setOrderPlaced(true);
        setCartItems([]);
        try {
          localStorage.removeItem("dormside_order_id");
          localStorage.removeItem("dormside_payment_intent");
        } catch {
          /* The receipt also carries its order ID. */
        }
        router.push(
          `/checkout/success?method=cash&fulfillment=${fulfillment}&order_id=${encodeURIComponent(orderId)}`,
        );
        return;
      }
      if (clientSecret) {
        try {
          localStorage.setItem("dormside_order_id", orderId);
        } catch {
          /* Payment redirects carry the order ID too. */
        }
        setPaymentSession({ clientSecret, orderId, signature });
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "We couldn’t connect. Please try again.",
      );
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };

  const field = (
    key: keyof Customer,
    title: string,
    placeholder: string,
    type = "text",
    autoComplete?: string,
  ) => {
    const showError = Boolean((touched[key] || submitAttempted) && errors[key]);
    return (
      <label
        className={`field-label ${key === "email" || key === "address" ? "full-width" : ""}`}
        htmlFor={`customer-${key}`}
      >
        {title}
        <input
          id={`customer-${key}`}
          name={key}
          type={type}
          autoComplete={autoComplete}
          required={key !== "address" || fulfillment === "delivery"}
          value={customer[key]}
          placeholder={placeholder}
          onChange={(event) =>
            setCustomer((previous) => ({
              ...previous,
              [key]: event.target.value,
            }))
          }
          onBlur={() =>
            setTouched((previous) => ({ ...previous, [key]: true }))
          }
          aria-invalid={showError}
          aria-describedby={showError ? `${key}-error` : undefined}
        />
        {showError && (
          <span id={`${key}-error`} className="field-error">
            {errors[key]}
          </span>
        )}
      </label>
    );
  };

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
      <main className="checkout-shell">
        {orderPlaced ? (
          <div className="checkout-loading" role="status">
            Order placed. Getting your receipt…
          </div>
        ) : !hydrated ? (
          <div className="checkout-loading" role="status">
            Getting your bag ready…
          </div>
        ) : cartItems.length === 0 ? (
          <div className="checkout-empty">
            <Icon name="bag" size={43} />
            <h1>Your bag is empty.</h1>
            <p>Add something from the menu to start your order.</p>
            <Link href="/#menu" className="primary-button">
              Browse menu <Icon name="arrow" size={18} />
            </Link>
          </div>
        ) : (
          <>
            <div className="checkout-title">
              <h1>Checkout</h1>
              <p>Choose pickup or delivery and confirm your order.</p>
            </div>
            {isOpen !== true && (
              <div className="notice" role="status">
                <Icon name="clock" />
                <div>
                  <strong>
                    {isOpen === false
                      ? "Orders are closed right now."
                      : "Confirming kitchen availability…"}
                  </strong>
                  <p>
                    {isOpen === false
                      ? "Your bag is saved. Come back when the kitchen reopens."
                      : "You can fill in your details while we check."}
                  </p>
                </div>
              </div>
            )}
            <div className="checkout-layout">
              <fieldset className="checkout-fields" disabled={locked}>
                <section className="checkout-panel">
                  <h2 className="panel-title">Pickup or delivery</h2>
                  <div className="option-grid">
                    <button
                      className="option-card"
                      aria-pressed={fulfillment === "pickup"}
                      onClick={() => setFulfillment("pickup")}
                    >
                      <Icon name="bag" />
                      <strong>Pickup</strong>
                      <span>
                        Pearl Hall
                        <br />
                        No extra charge
                      </span>
                    </button>
                    <button
                      className="option-card"
                      aria-pressed={fulfillment === "delivery"}
                      onClick={() => setFulfillment("delivery")}
                    >
                      <Icon name="bike" />
                      <strong>Delivery</strong>
                      <span>
                        Your building & room
                        <br />
                        $3 delivery fee
                      </span>
                    </button>
                  </div>
                </section>
                <section className="checkout-panel">
                  <h2 className="panel-title">Contact details</h2>
                  <p className="panel-description">
                    We’ll send your receipt to this email.
                  </p>
                  <div className="form-grid">
                    {field("name", "Full name", "Your name", "text", "name")}
                    {field(
                      "phone",
                      "Phone number",
                      "(859) 555-0123",
                      "tel",
                      "tel",
                    )}
                    {field(
                      "email",
                      "Email address",
                      "you@centre.edu",
                      "email",
                      "email",
                    )}
                    {fulfillment === "delivery" &&
                      field(
                        "address",
                        "Building & room number",
                        "Pearl Hall, Room 210",
                        "text",
                        "street-address",
                      )}
                  </div>
                </section>
                <details
                  id="tip-details"
                  className="checkout-panel tip-details"
                >
                  <summary>
                    Add a tip <span>Optional</span>
                  </summary>
                  <div className="tip-options" aria-label="Choose a tip">
                    {[0, 1, 2, 3].map((amount) => (
                      <button
                        key={amount}
                        aria-pressed={tip === amount && tipValid}
                        onClick={() =>
                          setTipInput(amount ? String(amount) : "")
                        }
                      >
                        {amount ? `$${amount}` : "No tip"}
                      </button>
                    ))}
                  </div>
                  <label className="field-label tip-input" htmlFor="tip-input">
                    Custom amount ($)
                    <input
                      id="tip-input"
                      inputMode="decimal"
                      value={tipInput}
                      onChange={(event) => setTipInput(event.target.value)}
                      placeholder="0.00"
                      aria-invalid={!tipValid}
                      aria-describedby={!tipValid ? "tip-error" : undefined}
                    />
                  </label>
                  {!tipValid && (
                    <p className="field-error" id="tip-error">
                      Enter a positive amount with up to two decimal places.
                    </p>
                  )}
                </details>
                <section className="checkout-panel">
                  <h2 className="panel-title">Payment</h2>
                  <div className="option-grid">
                    <button
                      className="option-card"
                      aria-pressed={paymentMethod === "cash"}
                      onClick={() => {
                        setPaymentMethod("cash");
                        setError(null);
                      }}
                    >
                      <Icon name="cash" />
                      <strong>Cash</strong>
                      <span>Pay at pickup or delivery</span>
                    </button>
                    <button
                      className="option-card"
                      aria-pressed={paymentMethod === "card"}
                      onClick={() => {
                        setPaymentMethod("card");
                        setError(null);
                      }}
                    >
                      <Icon name="card" />
                      <strong>Pay online</strong>
                      <span>Card & supported wallets</span>
                    </button>
                  </div>
                </section>
              </fieldset>
              <aside
                className="checkout-panel checkout-summary"
                aria-label="Order summary"
              >
                <div className="summary-heading">
                  <h2>Your order</h2>
                  <Link href="/#menu">Edit bag</Link>
                </div>
                {cartItems.map((item) => (
                  <div className="bag-item" key={item.name}>
                    <FoodPhoto item={item} />
                    <div className="bag-item-info">
                      <h3>{item.name}</h3>
                      <p>
                        {item.quantity} × {money(parsePrice(item.price))}
                      </p>
                    </div>
                    <strong>
                      {money(parsePrice(item.price) * item.quantity)}
                    </strong>
                  </div>
                ))}
                <div className="order-bottom">
                  <div className="cost-row">
                    <span>Subtotal</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  <div className="cost-row">
                    <span>
                      {fulfillment === "pickup"
                        ? "Pickup at Pearl Hall"
                        : "Delivery"}
                    </span>
                    <span
                      className={fulfillment === "pickup" ? "free-label" : ""}
                    >
                      {fulfillment === "pickup" ? "Free" : money(deliveryFee)}
                    </span>
                  </div>
                  <div className="cost-row">
                    <span>Tip</span>
                    <span>{money(tip)}</span>
                  </div>
                  <div className="total-row">
                    <span>Total</span>
                    <strong>{money(total)}</strong>
                  </div>
                </div>
                <div className="checkout-payment">
                  {paymentSession && sessionCurrent ? (
                    <>
                      <button
                        className="text-button"
                        disabled={paymentBusy}
                        onClick={() => {
                          setPaymentSession(null);
                          setError(null);
                        }}
                      >
                        Edit order details <Icon name="back" size={15} />
                      </button>
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret: paymentSession.clientSecret,
                          appearance: {
                            theme: "stripe",
                            variables: {
                              colorPrimary: "#d84932",
                              colorText: "#252922",
                              borderRadius: "9px",
                              fontFamily: "Arial, sans-serif",
                            },
                          },
                        }}
                      >
                        <CheckoutForm
                          disabled={
                            !valid || isOpen !== true || !sessionCurrent
                          }
                          orderId={paymentSession.orderId}
                          total={total}
                          onSubmittingChange={setPaymentBusy}
                          billingDetails={{
                            name: customer.name,
                            email: customer.email,
                            phone: customer.phone,
                          }}
                        />
                      </Elements>
                    </>
                  ) : (
                    <>
                      <p className="checkout-hint">
                        {paymentMethod === "cash"
                          ? `You’ll pay ${money(total)} in cash when ${fulfillment === "delivery" ? "your food arrives" : "you pick up your food"}.`
                          : "You’ll enter your payment details securely in the next step."}
                      </p>
                      <button
                        className="primary-button"
                        onClick={() => void submit()}
                        disabled={submitting || isOpen !== true}
                      >
                        {submitting
                          ? "Getting your order ready…"
                          : paymentMethod === "cash"
                            ? `Place order · ${money(total)}`
                            : "Continue to payment"}
                        {!submitting && <Icon name="arrow" size={18} />}
                      </button>
                    </>
                  )}
                  {error && (
                    <div className="checkout-error" role="alert">
                      {error}
                    </div>
                  )}
                  <p className="payment-note">
                    <Icon name="lock" size={12} />{" "}
                    {paymentMethod === "cash"
                      ? "No payment taken online"
                      : "Payments secured by Stripe"}
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

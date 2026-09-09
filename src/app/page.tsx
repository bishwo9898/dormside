"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Brand, FoodPhoto, Icon, QuantityControl } from "@/components/shop-ui";
import { useCart, usePreference } from "@/components/use-cart";
import { money, parsePrice, type MenuItem, type Fulfillment } from "@/lib/shop";

export default function Home() {
  const { cartItems, setCartItems } = useCart();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState(false);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [savedFulfillment, setFulfillment] = usePreference(
    "dormside_fulfillment",
    "pickup",
  );
  const fulfillment: Fulfillment =
    savedFulfillment === "delivery" ? "delivery" : "pickup";
  const [cartOpen, setCartOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  const loadMenu = useCallback(async () => {
    try {
      const response = await fetch("/api/menu", { cache: "no-store" });
      if (!response.ok) throw new Error("Menu unavailable");
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error("Menu unavailable");
      setMenuItems(data.items);
      setMenuError(false);
    } catch {
      setMenuError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) throw new Error("Status unavailable");
        const data = await response.json();
        setIsOpen(typeof data.isOpen === "boolean" ? data.isOpen : null);
      } catch {
        setIsOpen(null);
      }
    };
    void loadMenu();
    void loadStatus();
    const interval = setInterval(() => {
      void loadMenu();
      void loadStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadMenu]);

  useEffect(() => {
    if (!cartOpen) return;
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, [cartOpen]);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + parsePrice(item.price) * item.quantity,
    0,
  );
  const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryFee = fulfillment === "delivery" && count > 0 ? 3 : 0;
  const total = subtotal + deliveryFee;
  const canOrder = isOpen === true && !menuError;

  const changeQuantity = (item: MenuItem, delta: number) => {
    if (delta > 0 && !canOrder) return;
    setCartItems((items) => {
      const existing = items.find((entry) => entry.name === item.name);
      if (!existing)
        return delta > 0 ? [...items, { ...item, quantity: 1 }] : items;
      return items
        .map((entry) =>
          entry.name === item.name
            ? { ...entry, quantity: entry.quantity + delta }
            : entry,
        )
        .filter((entry) => entry.quantity > 0);
    });
    setAnnouncement(
      delta > 0
        ? `${item.name} added to your bag.`
        : `Removed one ${item.name} from your bag.`,
    );
  };

  const prepareCheckout = () => {
    try {
      localStorage.setItem("dormside_fulfillment", fulfillment);
    } catch {
      /* Checkout also lets the customer choose. */
    }
  };

  const orderContents = (
    <>
      <div className="order-heading">
        <div>
          <h2>
            Your order{" "}
            <span className="muted-count">{count > 0 ? `(${count})` : ""}</span>
          </h2>
        </div>
        <span className="order-bag-icon">
          <Icon name="bag" size={23} />
        </span>
      </div>
      <div className="fulfillment-switch" aria-label="Order type">
        <button
          aria-pressed={fulfillment === "pickup"}
          onClick={() => setFulfillment("pickup")}
        >
          <Icon name="bag" size={17} />
          Pickup
        </button>
        <button
          aria-pressed={fulfillment === "delivery"}
          onClick={() => setFulfillment("delivery")}
        >
          <Icon name="bike" size={18} />
          Delivery
        </button>
      </div>
      <p className="fulfillment-note">
        <Icon name="pin" size={14} />
        {fulfillment === "pickup"
          ? "Pick up at Pearl Hall · Free"
          : "To your building · $3 delivery"}
      </p>
      {count === 0 ? (
        <div className="empty-bag">
          <p>Add items from the menu to get started.</p>
          {cartOpen && (
            <button className="text-button" onClick={() => setCartOpen(false)}>
              Browse menu <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="bag-items">
          {cartItems.map((item) => (
            <div className="bag-item" key={item.name}>
              <FoodPhoto item={item} />
              <div className="bag-item-info">
                <h3>{item.name}</h3>
                <div className="bag-item-bottom">
                  <QuantityControl
                    name={item.name}
                    quantity={item.quantity}
                    onChange={(delta) => changeQuantity(item, delta)}
                    disabled={!canOrder}
                  />
                  <strong>
                    {money(parsePrice(item.price) * item.quantity)}
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="order-bottom">
        {count > 0 && (
          <>
            <div className="cost-row">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="cost-row">
              <span>{fulfillment === "pickup" ? "Pickup" : "Delivery"}</span>
              <span className={fulfillment === "pickup" ? "free-label" : ""}>
                {fulfillment === "pickup" ? "Free" : money(deliveryFee)}
              </span>
            </div>
          </>
        )}
        <div className="total-row">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        {count > 0 && canOrder ? (
          <Link
            href="/checkout"
            onClick={prepareCheckout}
            className="primary-button checkout-button"
          >
            Go to checkout <Icon name="arrow" size={19} />
          </Link>
        ) : (
          <button className="primary-button checkout-button" disabled>
            {!canOrder ? "Ordering unavailable" : "Add items to order"}
            <Icon name="arrow" size={19} />
          </button>
        )}
        <p className="payment-note">
          <Icon name="lock" size={12} /> Cash or secure online payment
        </p>
      </div>
    </>
  );

  return (
    <div className="storefront">
      <a href="#menu" className="skip-link">
        Skip to menu
      </a>
      <header className="site-header">
        <div className="shell header-inner">
          <Brand />
          <button
            className="header-bag"
            onClick={() => setCartOpen(true)}
            aria-label={`Open your bag, ${count} items`}
          >
            <Icon name="bag" size={19} /> Bag{" "}
            <span className="bag-count">{count}</span>
          </button>
        </div>
      </header>
      <main className="shell menu-section" id="menu">
        <div className="menu-intro">
          <div className="menu-title-row">
            <h1>Menu</h1>
            <span
              className={`open-status ${isOpen === false ? "is-closed" : ""}`}
            >
              <span />
              {isOpen === null
                ? "Checking availability"
                : isOpen
                  ? "Open for orders"
                  : "Currently closed"}
            </span>
          </div>
          <p>
            Free pickup at Pearl Hall <span aria-hidden="true">·</span> $3
            delivery
          </p>
        </div>
        {isOpen !== true && !loading && (
          <div className="notice" role="status">
            <Icon name="clock" size={18} />
            <p>
              {isOpen === false
                ? "Ordering is closed right now. You can still browse the menu."
                : "Ordering is paused while we confirm kitchen availability."}
            </p>
          </div>
        )}
        <div className="menu-layout">
          <section className="menu-content" aria-label="Available food">
            {menuError ? (
              <div className="menu-empty" role="alert">
                <h2>The menu couldn’t load.</h2>
                <p>Please try again.</p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setLoading(true);
                    void loadMenu();
                  }}
                >
                  Retry
                </button>
              </div>
            ) : loading ? (
              <div
                className="menu-list"
                aria-label="Loading menu"
                aria-busy="true"
              >
                {[0, 1, 2, 3].map((i) => (
                  <div className="menu-skeleton" key={i}>
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : menuItems.length === 0 ? (
              <div className="menu-empty">
                <h2>No items available yet.</h2>
                <p>Please check back soon.</p>
              </div>
            ) : (
              <div className="menu-list">
                {menuItems.map((item) => {
                  const quantity =
                    cartItems.find((entry) => entry.name === item.name)
                      ?.quantity ?? 0;
                  return (
                    <article className="menu-item" key={item.name}>
                      <FoodPhoto item={item} />
                      <div className="menu-item-info">
                        <h2>{item.name}</h2>
                        <p>{item.description}</p>
                        <strong>{money(parsePrice(item.price))}</strong>
                      </div>
                      <div className="menu-item-action">
                        {quantity > 0 ? (
                          <QuantityControl
                            name={item.name}
                            quantity={quantity}
                            onChange={(delta) => changeQuantity(item, delta)}
                            disabled={!canOrder}
                          />
                        ) : (
                          <button
                            className="add-button"
                            onClick={() => changeQuantity(item, 1)}
                            disabled={!canOrder}
                            aria-label={`Add ${item.name} to your bag`}
                          >
                            Add <Icon name="plus" size={16} />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <aside className="desktop-order" aria-label="Your order">
            {orderContents}
          </aside>
        </div>
      </main>
      {count > 0 && (
        <div className="mobile-bag-bar">
          <button onClick={() => setCartOpen(true)}>
            <span className="mobile-bag-count">{count}</span>
            <span>View bag</span>
            <strong>{money(total)}</strong>
            <Icon name="arrow" size={19} />
          </button>
        </div>
      )}
      {cartOpen && (
        <dialog
          ref={dialog}
          className="cart-dialog"
          aria-label="Your bag"
          onCancel={() => setCartOpen(false)}
          onClose={() => setCartOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false);
          }}
        >
          <div className="cart-sheet">
            <div className="sheet-handle" />
            <button
              className="sheet-close"
              onClick={() => setCartOpen(false)}
              aria-label="Close your bag"
              autoFocus
            >
              <Icon name="close" />
            </button>
            {orderContents}
          </div>
        </dialog>
      )}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
    </div>
  );
}

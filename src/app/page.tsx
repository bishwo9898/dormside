"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Brand, FoodPhoto, Icon, QuantityControl } from "@/components/shop-ui";
import { useCart, usePreference } from "@/components/use-cart";
import {
  itemCategory,
  money,
  parsePrice,
  type MenuItem,
  type Fulfillment,
} from "@/lib/shop";

const categories = [
  "Everything",
  "To share",
  "Sides & bowls",
  "Sweet treats",
  "Drinks",
];

export default function Home() {
  const { cartItems, setCartItems } = useCart();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState(false);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [category, setCategory] = useState("Everything");
  const [search, setSearch] = useState("");
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
  const filteredItems = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          (category === "Everything" || itemCategory(item) === category) &&
          `${item.name} ${item.description}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [menuItems, category, search],
  );
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
          <span className="eyebrow">GOOD THINGS AHEAD</span>
          <h2>
            Your bag{" "}
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
          <div className="empty-bag-art">
            <Icon name="bag" size={40} />
            <span>
              <Icon name="heart" size={15} />
            </span>
          </div>
          <h3>A little empty in here.</h3>
          <p>
            Find something you love.
            <br />
            We’ll keep it right here.
          </p>
          {cartOpen && (
            <button className="text-button" onClick={() => setCartOpen(false)}>
              Explore the menu <Icon name="arrow" size={16} />
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
            {!canOrder ? "Ordering unavailable" : "Add something delicious"}
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
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#menu" className="active">
              The menu
            </a>
            <a href="#how-it-works">How it works</a>
          </nav>
          <div className="header-actions">
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
            <button
              className="header-bag"
              onClick={() => setCartOpen(true)}
              aria-label={`Open your bag, ${count} items`}
            >
              <Icon name="bag" />
              <span>Bag</span>
              <span className="bag-count">{count}</span>
            </button>
          </div>
        </div>
      </header>
      <main>
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-star">✳</span> GOOD FOOD. RIGHT HERE.
            </p>
            <h1 id="hero-title">
              Big cravings.
              <br />
              <span>Little effort.</span>
            </h1>
            <p className="hero-description">
              Study break? Movie night? Just hungry?
              <br className="desktop-break" /> Your next good bite is a few taps
              away.
            </p>
            <div className="hero-actions">
              <a href="#menu" className="primary-button">
                Find your next bite <Icon name="arrow" />
              </a>
              <span className="hero-pickup">
                <Icon name="pin" size={16} /> Pickup at Pearl Hall
              </span>
            </div>
            <div className="hero-perks">
              <span>
                <Icon name="check" size={15} /> Easy pickup
              </span>
              <span>
                <Icon name="check" size={15} /> Delivery to your door
              </span>
              <span>
                <Icon name="check" size={15} /> Made for sharing
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-photo-wrap">
              <Image
                src="/images/sharing-spread.webp"
                alt="Cheeseburger sliders, buffalo wings and nachos ready to share"
                width={1400}
                height={933}
                priority
                sizes="(max-width: 640px) 100vw, 55vw"
              />
            </div>
            <div className="hero-stamp">
              <Icon name="spark" size={21} />
              <span>
                GOOD FOOD.
                <br />
                GOOD COMPANY.
              </span>
            </div>
            <div className="hero-caption">
              <span className="caption-icon">
                <Icon name="utensils" size={20} />
              </span>
              <div>
                <strong>Bring your appetite.</strong>
                <span>There’s plenty to go around.</span>
              </div>
            </div>
            <span className="hero-doodle" aria-hidden="true">
              ✳
            </span>
          </div>
        </section>
        <div className="service-strip">
          <div className="shell service-inner">
            <span>
              <Icon name="bag" size={18} />
              <strong>Your food, your way.</strong>
            </span>
            <span>Free pickup at Pearl Hall</span>
            <span className="strip-dot">·</span>
            <span>Delivery for just $3</span>
            <a href="#how-it-works">
              How it works <Icon name="arrow" size={16} />
            </a>
          </div>
        </div>
        <section
          className="menu-section shell"
          id="menu"
          aria-labelledby="menu-title"
        >
          <div className="menu-intro">
            <div>
              <p className="eyebrow">THE GOOD STUFF</p>
              <h2 id="menu-title">What sounds good?</h2>
              <p>A little comfort food. A lot to love.</p>
            </div>
            <label className="search-box">
              <Icon name="search" size={18} />
              <input
                type="search"
                placeholder="Find your craving…"
                aria-label="Search the menu"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  <Icon name="close" size={16} />
                </button>
              )}
            </label>
          </div>
          <div className="category-bar" aria-label="Menu categories">
            {categories.map((name) => (
              <button
                key={name}
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name === "Everything" && <Icon name="utensils" size={16} />}
                {name}
                <span>
                  {name === "Everything"
                    ? menuItems.length
                    : menuItems.filter((item) => itemCategory(item) === name)
                        .length}
                </span>
              </button>
            ))}
          </div>
          {!isOpen && !loading && (
            <div className="notice" role="status">
              <Icon name="clock" />
              <div>
                <strong>
                  {isOpen === false
                    ? "The kitchen’s taking a break."
                    : "We’re checking with the kitchen."}
                </strong>
                <p>
                  {isOpen === false
                    ? "Feel free to browse. Ordering will be back when we reopen."
                    : "Ordering is paused until we can confirm availability. Please check back shortly."}
                </p>
              </div>
            </div>
          )}
          <div className="menu-layout">
            <div className="menu-content">
              <div className="menu-results-label">
                <h3>
                  {search
                    ? `Results for “${search}”`
                    : category === "Everything"
                      ? "A little of everything"
                      : category}
                </h3>
                <span>
                  {loading
                    ? "Loading menu…"
                    : `${filteredItems.length} ${filteredItems.length === 1 ? "option" : "options"}`}
                </span>
              </div>
              {menuError ? (
                <div className="menu-empty" role="alert">
                  <Icon name="utensils" size={32} />
                  <h3>The menu couldn’t load.</h3>
                  <p>Let’s give that another try.</p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setLoading(true);
                      void loadMenu();
                    }}
                  >
                    Try again <Icon name="arrow" size={16} />
                  </button>
                </div>
              ) : loading ? (
                <div
                  className="food-grid"
                  aria-label="Loading menu"
                  aria-busy="true"
                >
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div className="menu-skeleton" key={i}>
                      <div />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="menu-empty">
                  <Icon name="search" size={32} />
                  <h3>
                    {menuItems.length === 0
                      ? "Something good is on its way."
                      : "No bites found."}
                  </h3>
                  <p>
                    {menuItems.length === 0
                      ? "Check back soon for the next menu."
                      : "Try another search or explore the full menu."}
                  </p>
                  {menuItems.length > 0 && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setSearch("");
                        setCategory("Everything");
                      }}
                    >
                      See everything <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="food-grid">
                  {filteredItems.map((item, index) => {
                    const quantity =
                      cartItems.find((entry) => entry.name === item.name)
                        ?.quantity ?? 0;
                    return (
                      <article
                        className={`food-card ${quantity ? "in-bag" : ""}`}
                        key={item.name}
                        style={{
                          animationDelay: `${Math.min(index, 5) * 45}ms`,
                        }}
                      >
                        <div className="card-image-wrap">
                          <FoodPhoto item={item} />
                          {quantity > 0 && (
                            <span className="in-bag-badge">
                              <Icon name="check" size={12} /> In your bag
                            </span>
                          )}
                          <span className="category-label">
                            {itemCategory(item)}
                          </span>
                        </div>
                        <div className="food-card-body">
                          <h3>{item.name}</h3>
                          <p>{item.description}</p>
                          <div className="food-card-bottom">
                            <strong>{money(parsePrice(item.price))}</strong>
                            {quantity > 0 ? (
                              <QuantityControl
                                name={item.name}
                                quantity={quantity}
                                onChange={(delta) =>
                                  changeQuantity(item, delta)
                                }
                                disabled={!canOrder}
                              />
                            ) : (
                              <button
                                className="add-button"
                                onClick={() => changeQuantity(item, 1)}
                                disabled={!canOrder}
                                aria-label={`Add ${item.name} to your bag`}
                              >
                                Add <Icon name="plus" size={17} />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              <p className="menu-footnote">
                Good food is better shared. Check each item for portion sizes.
                <br />
                Menu images are illustrative; your food may look a little
                different.
              </p>
            </div>
            <aside className="desktop-order" aria-label="Your order">
              {orderContents}
            </aside>
          </div>
        </section>
        <section
          className="how-section shell"
          id="how-it-works"
          aria-labelledby="how-title"
        >
          <div className="how-heading">
            <span className="eyebrow">LESS SCROLLING. MORE SNACKING.</span>
            <h2 id="how-title">
              From craving to
              <br />
              “that hit the spot.”
            </h2>
          </div>
          <div className="how-step">
            <span>01</span>
            <Icon name="utensils" size={25} />
            <h3>Find your favorites</h3>
            <p>
              A tray for the group or a little treat for you. Fill your bag.
            </p>
          </div>
          <div className="how-step">
            <span>02</span>
            <Icon name="bag" size={25} />
            <h3>Make it your way</h3>
            <p>
              Pick up at Pearl Hall or get it delivered. Pay online or with
              cash.
            </p>
          </div>
          <div className="how-step">
            <span>03</span>
            <Icon name="heart" size={25} />
            <h3>Enjoy the good stuff</h3>
            <p>Put the books down. Get your friends together. Dig in.</p>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <div>
            <Brand />
            <p>Good food. A little closer.</p>
          </div>
          <p>Made for your kind of hungry.</p>
          <span>© {new Date().getFullYear()} Dormside</span>
        </div>
      </footer>
      {count > 0 && (
        <div className="mobile-bag-bar">
          <button onClick={() => setCartOpen(true)}>
            <span className="mobile-bag-count">{count}</span>
            <span>View your bag</span>
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

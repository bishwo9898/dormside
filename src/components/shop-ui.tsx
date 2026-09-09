"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { itemImage, type MenuItem } from "@/lib/shop";

const paths = {
  bag: "M6 7h12l2 14H4L6 7ZM9 8V6a3 3 0 0 1 6 0v2",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  back: "M20 12H4m6-6-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  check: "m5 12 4 4L19 6",
  leaf: "M20 3C9 2 3 7 5 14s13 8 15-11ZM4 21l10-11",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2",
  bike: "M10 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM22 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM6 17l5-9 7 9M9 8h5m1-4h3l2 5M10 17h8",
  utensils: "M4 3v5a3 3 0 0 0 6 0V3M7 3v18M18 21V3c-4 2-4 10 0 10",
  spark: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z",
  lock: "M6 10h12v11H6V10ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3",
  card: "M2 5h20v14H2V5ZM2 9h20M6 15h4",
  cash: "M2 5h20v14H2V5ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M5 12h.01M19 12h.01",
};

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: keyof typeof paths;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Dormside home">
      <span className="brand-mark">
        <svg
          width="25"
          height="25"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 12a9 9 0 0 1 18 0H5ZM4 16h20M6 20h16"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M12 7h.01M17 8h.01"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span>
        dormside<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}

export function FoodPhoto({
  item,
  className = "",
  style,
}: {
  item: MenuItem;
  className?: string;
  style?: CSSProperties;
}) {
  const src = itemImage(item);
  const [failed, setFailed] = useState<string>();
  return (
    <div className={`food-photo ${className}`} style={style}>
      {src && src !== failed ? (
        // Admin-managed URLs may be external; keep a graceful fallback without requiring a domain allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(src)}
        />
      ) : (
        <span className="food-placeholder">
          <Icon name="utensils" size={34} />
          <span>Made to enjoy</span>
        </span>
      )}
    </div>
  );
}

export function QuantityControl({
  name,
  quantity,
  onChange,
  disabled = false,
}: {
  name: string;
  quantity: number;
  onChange: (delta: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="quantity-control">
      <button
        type="button"
        onClick={() => onChange(-1)}
        aria-label={`Remove one ${name}`}
      >
        <Icon name="minus" size={16} />
      </button>
      <span aria-label={`${quantity} in your bag`}>{quantity}</span>
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={disabled}
        aria-label={`Add one ${name}`}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

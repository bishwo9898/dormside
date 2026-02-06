import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export const getStripe = () => {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2026-01-28.clover",
  });

  return stripeClient;
};

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const stripeSecret = process.env.STRIPE_SECRET_KEY ?? "";
  const stripePublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const emailConfigured = Boolean(
    process.env.EMAIL_HOST &&
      process.env.EMAIL_PORT &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS,
  );

  return NextResponse.json({
    stripeSecretConfigured: stripeSecret.startsWith("sk_live_") || stripeSecret.startsWith("sk_test_"),
    stripePublishableConfigured:
      stripePublishable.startsWith("pk_live_") || stripePublishable.startsWith("pk_test_"),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    emailConfigured,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    requiresDatabase: process.env.VERCEL === "1" || process.env.VERCEL === "true",
  });
}

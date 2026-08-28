## Launch checklist

Before accepting real orders, configure these environment variables in the hosting provider (not just in a local `.env` file):

```text
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=orders@your-domain.example
EMAIL_PASS=your-16-character-gmail-app-password
EMAIL_FROM=Dormside Eats <orders@your-domain.example>
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
ADMIN_SESSION_SECRET=long-random-secret
```

Stripe must be configured to send `payment_intent.succeeded` events to:

```text
https://YOUR-DOMAIN/api/stripe/webhook
```

Use a real Postgres `DATABASE_URL` when deploying to Vercel; its filesystem is not durable, so the app intentionally refuses to save live orders there without a database. The authenticated admin page includes a launch-readiness panel that checks whether the required payment, webhook, email, and database settings are present.

For Gmail, `EMAIL_PASS` must be a current Google App Password. It is not the regular Gmail password; spaces shown by Google are removed automatically.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

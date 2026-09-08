# Settlify

Invoicing and payment-recovery tool for freelancers — multi-currency
invoices, overdue tracking with automatic late fees, Stripe/PayPal/bank
payout links, and one-click payment chaser emails.

## Run locally

```
npm install
npm run dev
```

## Build for production

```
npm run build
```

Deploy the `dist/` folder to Vercel or Netlify (or connect the repo directly
for auto-deploys on push).

## Turning this into a paid subscription

See [SUBSCRIPTION-SETUP.md](./SUBSCRIPTION-SETUP.md) for the full walkthrough
— accounts, Stripe billing, and the webhook that unlocks access after
payment.

# Turning Settlify into a paid monthly subscription

Right now, Settlify is a single-user tool: whoever opens it sees one set of data,
saved only in their own browser. To charge people monthly, you need three new
pieces working together. Here's what each one does and how to wire it up.

**Payment provider: Dodo Payments**, not Stripe — Stripe's India onboarding is
effectively closed to solo individual founders. Dodo is a **Merchant of
Record**: they legally become the seller of record, which means you don't
need a registered business entity to sell internationally, and they handle
GST/VAT/sales tax compliance for you. They support Indian UPI/cards and
220+ countries in one integration.

## The three pieces

1. **Accounts (Supabase Auth)** — so the app knows *who* is using it, not just
   "whoever has this browser open."
2. **Subscriptions (Dodo Payments)** — recurring monthly charges, tax handled
   for you as MoR.
3. **A webhook (Vercel serverless function)** — the missing link. When someone
   pays, Dodo needs to tell your app "this person is now paid." That
   notification is a webhook — a small backend endpoint that can't live in a
   static React app, which is why this step needs a few lines of server code.

Without the webhook, you'd have payments happening in Dodo with no way to
know who paid — so this step isn't optional if you're doing subscriptions.

## Step 1 — Supabase (accounts + database)

1. Create a free project at supabase.com
2. In the SQL editor, create a table to track subscription status:
   ```sql
   create table profiles (
     id uuid references auth.users primary key,
     email text,
     dodo_customer_id text,
     dodo_subscription_id text,
     subscription_status text default 'inactive',
     next_billing_date timestamptz
   );
   ```
3. In Supabase Auth settings, enable Email/Password (or Google) sign-in.
4. Install the client in your repo:
   ```
   npm install @supabase/supabase-js
   ```
5. Create `src/lib/supabase.js`:
   ```js
   import { createClient } from '@supabase/supabase-js';
   export const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );
   ```
6. Add a `.env` file (never commit this):
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## Step 2 — Dodo Payments (the actual billing)

1. Sign up at dodopayments.com and complete merchant onboarding (much lighter
   than Stripe's India requirements — no registered company needed to start).
2. In the Dodo dashboard, create a subscription Product ("Settlify Pro",
   e.g. $9/month or ₹399/month). Copy the Product ID (`pdt_...`).
3. Get your API key from Settings → API Keys, and a webhook secret from
   Settings → Webhooks once you add an endpoint (Step 3 below).
4. Install the SDK:
   ```
   npm install dodopayments
   ```

**Important Dodo-specific detail:** set the subscription's billing *period*
much longer than its billing *frequency* (e.g. period = 20 years, frequency =
1 month). If period and frequency match, the subscription runs once and
expires instead of renewing monthly — this is a common setup mistake.

## Step 3 — The webhook (Vercel serverless functions)

Create `api/create-checkout-session.js` in your repo root:

```js
import DodoPayments from 'dodopayments';

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT, // 'test_mode' or 'live_mode'
});

export default async function handler(req, res) {
  const { userId, email, name } = req.body;

  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: process.env.DODO_PRODUCT_ID, quantity: 1 }],
    customer: { email, name },
    // Lock currency/country explicitly — otherwise Dodo detects it from the
    // customer's IP, and it's fixed for the subscription's lifetime after
    // the first charge.
    billing_currency: 'USD',
    return_url: `${process.env.SITE_URL}/?success=true`,
    metadata: { userId },
  });

  res.status(200).json({ url: session.checkout_url });
}
```

Create `api/dodo-webhook.js` — this is the piece that unlocks access after
payment. Dodo follows the Standard Webhooks spec, and the official SDK
verifies signatures for you:

```js
import DodoPayments from 'dodopayments';
import { createClient } from '@supabase/supabase-js';

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT,
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const rawBody = await buffer(req);
  let event;
  try {
    event = client.webhooks.unwrap(rawBody.toString(), {
      headers: {
        'webhook-id': req.headers['webhook-id'],
        'webhook-signature': req.headers['webhook-signature'],
        'webhook-timestamp': req.headers['webhook-timestamp'],
      },
    });
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  const sub = event.data;

  // subscription.active: first authorization succeeded — grant access.
  // subscription.renewed: a recurring charge succeeded — extend access.
  if (event.type === 'subscription.active' || event.type === 'subscription.renewed') {
    await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        dodo_customer_id: sub.customer_id,
        dodo_subscription_id: sub.subscription_id,
        next_billing_date: sub.next_billing_date,
      })
      .eq('id', sub.metadata?.userId ?? undefined)
      .eq('dodo_subscription_id', sub.subscription_id);
  }

  // subscription.on_hold: a renewal payment failed — recoverable, prompt
  // the customer to update their card, but don't cut access immediately.
  if (event.type === 'subscription.on_hold') {
    await supabase
      .from('profiles')
      .update({ subscription_status: 'on_hold' })
      .eq('dodo_subscription_id', sub.subscription_id);
  }

  // subscription.failed: terminal — the initial payment method could never
  // be authorized. Never grant access on this event.
  if (event.type === 'subscription.failed') {
    await supabase
      .from('profiles')
      .update({ subscription_status: 'inactive' })
      .eq('dodo_subscription_id', sub.subscription_id);
  }

  res.status(200).json({ received: true });
}

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
```

In the Dodo dashboard, go to Settings → Webhooks → Add Webhook, point it at
`https://your-domain.vercel.app/api/dodo-webhook`, and subscribe to
`subscription.active`, `subscription.renewed`, `subscription.on_hold`, and
`subscription.failed`. Copy the signing secret into
`DODO_PAYMENTS_WEBHOOK_KEY`.

Webhooks can arrive more than once (retries) — the code above updates by ID
rather than assuming single delivery, which keeps it safe either way.

## Step 4 — Gate the app behind subscription_status

In `App.jsx`, before rendering the invoice tool, check the logged-in user's
`profiles.subscription_status`. Show the tool only when it's `'active'`;
show a "Subscribe to continue" screen otherwise, with a button that calls
`/api/create-checkout-session` and redirects to the returned
`checkout_url`. If status is `'on_hold'`, show a distinct "update your
payment method" message rather than the generic subscribe screen — that
customer already paid once and just needs to fix a failed renewal.

## A note if most of your customers will be Indian, not global

Indian card renewals run on an RBI e-mandate and can take up to ~48 hours to
settle, and auto-debits above ₹15,000 need fresh customer authentication.
None of this needs special handling in your code, but it means "the
customer paid" and "the webhook confirms it" can be hours apart for Indian
cards specifically — don't be alarmed if activation isn't instant for those
users.

## Environment variables you'll need on Vercel

```
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_ENVIRONMENT=
DODO_PAYMENTS_WEBHOOK_KEY=
DODO_PRODUCT_ID=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SITE_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Cost while small

- Supabase: free up to 50,000 monthly active users
- Vercel: free for hobby projects, serverless functions included
- Dodo Payments: no monthly fee — 4% + 15¢ on Indian UPI/cards, +1.5% on
  international cards, charged only when you actually earn

Nothing here costs money until you actually have paying customers.

## What to ask Claude for next

- "Add the Supabase login screen to Settlify" — I'll build the actual
  login/signup UI component
- "Add the subscription gate to App.jsx" — I'll wire in the check that shows
  the tool only to active subscribers
- "Help me test the Dodo webhook locally" — walking through their test mode
  and a local tunnel so you can see events before going live

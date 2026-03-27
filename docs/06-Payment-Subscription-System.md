---
id: "06-Payment-Subscription-System"
slug: "/06-Payment-Subscription-System"
sidebar_position: 6
sidebar_label: "Payment & Subscription System"
---

# 06 — Payment & Subscription System

> Dual monetization through Helix virtual currency and Luminary novel subscriptions, powered by Stripe and PayPal with full provider parity.

---

## Table of Contents

- [System Overview](#system-overview)
- [Product Catalog & Provisioning](#product-catalog--provisioning)
- [Helix Virtual Currency](#helix-virtual-currency)
- [Luminary Subscriptions](#luminary-subscriptions)
- [Purchase Flows — Helix](#purchase-flows--helix)
- [Purchase Flows — Subscriptions](#purchase-flows--subscriptions)
- [Chapter Unlock Flow](#chapter-unlock-flow)
- [Access Checks](#access-checks)
- [Webhook Processing](#webhook-processing)
- [Payment Audit Trail](#payment-audit-trail)
- [Environment Configuration](#environment-configuration)
- [API Route Map](#api-route-map)
- [Database Tables](#database-tables)
- [Library Files](#library-files)
- [Security](#security)
- [Cross-References](#cross-references)

---

## System Overview

Genesis Studio uses a **dual monetization model** with **two payment providers**:

### What You Sell

| Product | Type | Scope | Price |
|---------|------|-------|-------|
| **Helix Packs** | One-time purchase | Virtual currency bundles | $9.99 — $99.99 |
| **Luminary Subscriptions** | Monthly recurring | All chapters for a specific novel | $29.99/month |

### Payment Providers

| Provider | Helix Purchases | Subscriptions | Client Integration |
|----------|----------------|---------------|-------------------|
| **Stripe** | Checkout Sessions (hosted) | Checkout Sessions (subscription mode) | Stripe hosted checkout page |
| **PayPal** | Orders API (capture flow) | Subscriptions API (billing plans) | PayPal Buttons SDK |

Both providers have **full parity** — every purchasable item has both Stripe IDs and PayPal IDs. If one is missing, the item should not be considered fully active.

### Architecture

```
Frontend (Next.js)
  │
  ├── POST /api/stripe/customer/ensure          → Ensure Stripe customer exists
  ├── POST /api/stripe/helix/create-checkout-session  → Create Stripe Checkout
  ├── POST /api/paypal/helix/create-order        → Create PayPal Order
  │         ...
  │
  ▼
Stripe / PayPal hosted checkout
  │
  ▼
Webhook → POST /api/webhooks/stripe   or   POST /api/webhooks/paypal
  │
  ├── Update wallets table (Helix credit)
  ├── Upsert subscriptions table (subscription activation)
  └── Insert payment_logs (audit trail)
```

All payment creation happens **server-side**. The client never sees prices, amounts, or product IDs directly — everything is fetched from the database by the API routes.

---

## Product Catalog & Provisioning

Before anyone can buy anything, Stripe and PayPal need Product and Price/Plan objects. Genesis stores the provider IDs in Supabase tables.

### Catalog Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `helix_packs` | Helix bundle definitions | `name`, `helix_amount`, `bonus_amount`, `helix_total`, `price_cents`, `stripe_product_id`, `stripe_price_id`, `paypal_product_id` |
| `subscription_plans` | Per-novel subscription plans | `novel_id`, `price_cents`, `stripe_product_id`, `stripe_price_id`, `paypal_product_id`, `paypal_plan_id` |

Dev mirrors (`dev_helix_packs`, `dev_subscription_plans`) exist for testing.

### Provisioning via Admin API

Provisioning is done through API routes (no CLI scripts needed):

| Endpoint | Purpose |
|----------|---------|
| `POST /api/admin/provision-all` | Provisions all helix packs + all subscription plans at once |
| `POST /api/admin/provision-novel-plan` | Provisions a single novel's Stripe + PayPal plan |
| `POST /api/admin/provision-helix-packs` | Provisions all helix pack Stripe + PayPal products |

**How provisioning works** (for each item):

1. Check if Stripe Product ID exists in the database row — if not, create via Stripe API
2. Check if Stripe Price ID exists — if not, create a Price attached to the Product
3. Check if PayPal Product ID exists — if not, create via PayPal Catalog API
4. For subscriptions: check if PayPal Plan ID exists — if not, create a Billing Plan
5. Store all IDs back in the database row

Provisioning is **idempotent** — running it again skips items that already have IDs.

### When to Provision

- **Helix packs**: After adding or modifying packs in the `helix_packs` table
- **Novel subscriptions**: When a novel is marked as subscribable in Directus. This can be triggered:
  - Manually via `POST /api/admin/provision-novel-plan { novelId }`
  - Automatically via a Directus Flow webhook on `novels.update` where `has_subscription` changes to `true`
  - Bulk via `POST /api/admin/provision-all`

### Parity Verification

Run `node scripts/check-parity.js` to verify every active pack and plan has both Stripe and PayPal IDs configured.

---

## Helix Virtual Currency

### Exchange Rate

```
100 Helix = 1 chapter unlock
```

### Wallet

Each user has a wallet record in the `wallets` table:

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID | Unique — one wallet per user |
| `helix` | integer | Default: 0 |
| `atoms` | integer | Default: 0 (reserved for future use) |

The wallet is created automatically on first access. Legacy `site_currencies` data (orbs/shards) is migrated on read.

### Helix Packs

Five predefined packs stored in the `helix_packs` table:

| Pack | Helix | Bonus | Total Helix | Price (USD) |
|------|-------|-------|-------------|-------------|
| Starter | 600 | — | 600 | $9.99 |
| Popular | 1,600 | +100 | 1,700 | $24.99 |
| Value | 3,500 | +300 | 3,800 | $49.99 |
| Premium | 5,900 | +600 | 6,500 | $74.99 |
| Ultimate | 9,300 | +1,000 | 10,300 | $99.99 |

The `helix_total` column is a generated column: `helix_amount + bonus_amount`.

Packs are fetched via `GET /api/helix-packs`, which reads from the environment-appropriate table.

---

## Luminary Subscriptions

### What They Are

A monthly subscription to a specific novel. While active, the subscriber has access to **all chapters** of that novel — no Helix required.

### Pricing

All novel subscriptions are $29.99/month (configurable per-plan in the `subscription_plans` table).

### Subscription Lifecycle

```
active → (auto-renews monthly)
active → cancelled  (user cancels or payment fails permanently)
active → expired    (end_date passes without renewal)
```

### Subscriptions Table

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID | FK to auth.users |
| `novel_id` | UUID | Directus novel UUID |
| `status` | text | `active`, `inactive`, `cancelled`, `expired` |
| `start_date` | timestamptz | When the subscription began |
| `end_date` | timestamptz | Current billing period end |
| `stripe_subscription_id` | text | Stripe `sub_xxx` ID |
| `paypal_subscription_id` | text | PayPal `I-xxx` ID |
| `payment_provider` | text | `stripe` or `paypal` |

**Unique constraint**: `(user_id, novel_id)` — one subscription per user per novel.

---

## Purchase Flows — Helix

### Stripe Flow

```
User clicks "Buy 1600 Helix"
        │
        ▼
Frontend: POST /api/stripe/customer/ensure
  → Checks payment_customers table for existing stripe_customer_id
  → If not found, creates Stripe Customer via API, stores ID
  → Returns { customerId }
        │
        ▼
Frontend: POST /api/stripe/helix/create-checkout-session
  Body: { helixPackId: 2 }
  → Reads pack from helix_packs table (gets stripe_price_id, helix_total)
  → Validates pack exists and is active
  → Validates customer exists
  → Creates Stripe Checkout Session:
      mode: 'payment'
      payment_method_types: ['card', 'link']  (Apple Pay, Google Pay, Link)
      metadata: { type: 'helix', userId, helixAmount }
      payment_intent_data.metadata: { type: 'helix', userId, helixAmount }
  → Returns { sessionId, url }
        │
        ▼
Frontend: window.location.href = session.url
  → User lands on Stripe's hosted checkout page
  → Enters card / Apple Pay / Google Pay / Link
  → Completes payment
  → Stripe redirects to /payment/success?type=helix&...
        │
        ▼
Stripe fires webhook → POST /api/webhooks/stripe
  Event: payment_intent.succeeded
  → Idempotency check: query payment_logs for this provider_transaction_id
  → If already processed, return { received: true }
  → Read metadata: type='helix', userId, helixAmount
  → Fetch wallet from wallets table (or default to 0)
  → Add helixAmount to current balance
  → Upsert wallet with new total
  → Insert payment_logs row with:
      - amount_cents, currency, status: 'succeeded'
      - helix_amount, payment method details
      - previous_balance, new_balance in metadata
      - Full raw Stripe event in raw_data
        │
        ▼
User now has 1600 more Helix
```

### PayPal Flow

```
User clicks "Buy with PayPal"
        │
        ▼
Frontend: POST /api/paypal/helix/create-order
  Body: { helixPackId: 2 }
  → Reads pack from helix_packs table
  → Calls PayPal Create Order API:
      intent: 'CAPTURE'
      amount: pack.price_cents / 100
      custom_id: "helix:{userId}:{helixTotal}:{customerId}"
  → Returns { orderId }
        │
        ▼
Frontend: renders PayPal Buttons SDK
  → createOrder returns the orderId
  → User logs into PayPal, approves payment
  → onApprove callback fires
        │
        ▼
Frontend: POST /api/paypal/helix/capture
  Body: { orderId }
  → Calls PayPal Capture Order API
  → Parses custom_id from capture response: "helix:{userId}:{helixTotal}:{customerId}"
  → Idempotency check: query payment_logs for this capture ID
  → If already processed, return { success: true, idempotent: true }
  → Fetch wallet, add helix, upsert wallet
  → Insert payment_logs with provider='paypal'
  → Returns { success: true, newHelix }
```

### Alternative: Direct PaymentIntent (Legacy)

There is also a `POST /api/stripe/helix/create-payment-intent` route that creates a raw Stripe PaymentIntent (for use with embedded Stripe Elements instead of hosted checkout). This is kept for backward compatibility but **Checkout Sessions are preferred**.

---

## Purchase Flows — Subscriptions

### Stripe Flow

```
User clicks "Subscribe to Novel X"
        │
        ▼
Frontend: POST /api/stripe/customer/ensure → { customerId }
        │
        ▼
Frontend: POST /api/stripe/subscriptions/create-checkout-session
  Body: { novelId: "uuid-xxx" }
  → Reads plan from subscription_plans table (gets stripe_price_id)
  → Fetches novel details for checkout customization (title, abbreviation)
  → Validates plan is active and stripe_price_id exists
  → Validates customer exists
  → Creates Stripe Checkout Session:
      mode: 'subscription'
      payment_method_types: ['card', 'link']
      metadata: { type: 'novel_subscription', userId, novelId, planId }
      subscription_data.metadata: { userId, novelId, planId }
  → Returns { sessionId, url }
        │
        ▼
User completes checkout on Stripe's hosted page
        │
        ▼
Stripe fires webhook → POST /api/webhooks/stripe
  Event: checkout.session.completed (mode='subscription')
  → Fetches the Stripe Subscription object for period details
  → Upserts into subscriptions table:
      { user_id, novel_id, status: 'active', start_date, end_date, stripe_subscription_id }
  → Inserts payment_logs row
        │
        ▼
Stripe ALSO fires: customer.subscription.created
  → Idempotency check (already logged this event + subscription ID?)
  → Upserts subscription record again (redundant safety net)
  → Inserts payment_logs row
        │
        ▼
User now has an active subscription — all chapters for Novel X are unlocked
```

### Stripe Renewal

```
Monthly billing cycle → Stripe auto-charges
  → Fires: invoice.payment_succeeded
  → Webhook fetches the renewed Stripe Subscription
  → Updates subscriptions.end_date to new period end
  → Inserts payment_logs with metadata.renewal = true
```

### Stripe Cancellation

```
User cancels (or payment fails permanently)
  → Stripe fires: customer.subscription.deleted
  → Webhook updates subscriptions.status = 'cancelled'
  → Inserts payment_logs with status = 'cancelled'
```

### PayPal Flow

```
User clicks "Subscribe with PayPal"
        │
        ▼
Frontend: POST /api/paypal/subscriptions/create
  Body: { novelId: "uuid-xxx" }
  → Reads plan from subscription_plans table (gets paypal_plan_id)
  → Stores mapping in paypal_subscription_pending table:
      { user_id, novel_id, plan_id }
      (needed because PayPal subscription webhooks don't carry user context)
  → Returns { planId, userId }
        │
        ▼
Frontend: renders PayPal Subscription Button
  → createSubscription callback:
      plan_id: planId
      custom_id: "novel_sub:{userId}:{novelId}"
  → User logs into PayPal, approves subscription
        │
        ▼
PayPal fires webhook → POST /api/webhooks/paypal
  Event: BILLING.SUBSCRIPTION.ACTIVATED
  → Parses custom_id: "novel_sub:{userId}:{novelId}"
  → Falls back to paypal_subscription_pending lookup by plan_id if custom_id missing
  → Upserts subscriptions table: status='active', paypal_subscription_id
  → Inserts payment_logs with provider='paypal'
```

### PayPal Cancellation / Suspension

| Event | Action |
|-------|--------|
| `BILLING.SUBSCRIPTION.CANCELLED` | Set status = 'cancelled' |
| `BILLING.SUBSCRIPTION.EXPIRED` | Set status = 'expired' |
| `BILLING.SUBSCRIPTION.SUSPENDED` | Set status = 'inactive' |

---

## Chapter Unlock Flow

### Sequential Enforcement

Chapters must be unlocked **in order**. A user cannot unlock Chapter 5 without owning Chapters 1–4. This is enforced server-side.

### Cost

Each chapter costs **100 Helix** (constant `HELIX_PER_CHAPTER`).

### Flow

```
User clicks a locked chapter
        │
        ▼
Frontend: POST /api/chapters/unlock
  Body: { chapter_id: "uuid", novel_id: "uuid" }
  (or: { chapterIds: ["uuid1","uuid2"], novel_id: "uuid" } for multi-unlock)
        │
        ▼
Backend validates:
  1. User is authenticated (Bearer token)
  2. Fetches latest 50 chapters for the novel (paid chapters)
  3. Target chapter is in the paid chapter set
  4. User doesn't already own the chapter (chapter_purchases table)
  5. All prior paid chapters are owned (sequential enforcement)
  6. Wallet balance >= 100 Helix
        │
        ▼
Backend executes:
  1. Deducts 100 Helix from wallets table
  2. Inserts chapter_purchases record (user_id, chapter_id, novel_id, helix_spent)
  3. If insert fails → rolls back helix to wallet (compensating transaction)
        │
        ▼
Returns: { success: true, newHelix, purchaseId, purchasedAt }
```

If sequential validation fails, the response includes a list of the unpurchased chapters the user needs first.

---

## Access Checks

These endpoints are called by the frontend to determine what a user has access to:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/novel-subscription?novel_id=xxx` | GET | Check if user has active subscription for a novel. Auto-expires if `end_date` has passed. Returns `{ hasSubscription, daysRemaining }` |
| `GET /api/unlocked/chapters` | GET | List all chapters the user has purchased (with novel info) |
| `GET /api/unlocked/subscriptions` | GET | List all active subscriptions (with novel banners) |
| `GET /api/wallet/balance` | GET | Current helix + atoms balance. Creates wallet on first call |
| `GET /api/subscriptions` | GET | List active subscriptions enriched with Directus novel data |

---

## Webhook Processing

### Stripe Webhook (`POST /api/webhooks/stripe`)

**Signature verification**: Every request is verified with `stripe.webhooks.constructEvent()` using `STRIPE_WEBHOOK_SECRET`. Invalid signatures receive a `400` response.

**Uses service role key**: The Supabase client in the webhook handler uses `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) because webhooks aren't authenticated by a user session.

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Process subscription creation after Stripe Checkout |
| `payment_intent.succeeded` | Credit Helix for helix purchases; legacy subscription handling |
| `payment_intent.payment_failed` | Log failure details to payment_logs |
| `customer.subscription.created` | Upsert subscription record (safety net for checkout.session.completed) |
| `customer.subscription.updated` | Update subscription status and period |
| `customer.subscription.deleted` | Mark subscription as cancelled |
| `invoice.payment_succeeded` | Update subscription end_date on renewal |

**Idempotency**: Every handler checks `payment_logs` for an existing record matching `(payment_provider, provider_transaction_id)` or `(payment_provider, provider_subscription_id, event_type)` before processing. Duplicate events return `{ received: true }` immediately.

### PayPal Webhook (`POST /api/webhooks/paypal`)

**Signature verification**: Uses PayPal's Notification Verification API via `verifyWebhookSignature()` in `src/lib/paypal.ts`. Requires `PAYPAL_WEBHOOK_ID` env var.

| Event | Action |
|-------|--------|
| `PAYMENT.CAPTURE.COMPLETED` | Credit Helix to wallet (parses `custom_id` format) |
| `PAYMENT.CAPTURE.DENIED` | Log failure |
| `PAYMENT.CAPTURE.REFUNDED` | Create refund record, find original transaction |
| `BILLING.SUBSCRIPTION.ACTIVATED` | Create/activate subscription record |
| `BILLING.SUBSCRIPTION.RE-ACTIVATED` | Reactivate subscription |
| `BILLING.SUBSCRIPTION.CANCELLED` | Cancel subscription |
| `BILLING.SUBSCRIPTION.EXPIRED` | Expire subscription |
| `BILLING.SUBSCRIPTION.SUSPENDED` | Suspend subscription (mark inactive) |

**PayPal custom_id formats**:
- Helix: `helix:{userId}:{helixTotal}:{customerId}`
- Subscription: `novel_sub:{userId}:{novelId}`

---

## Payment Audit Trail

Every payment event is logged to the `payment_logs` table. This provides a complete audit trail.

### What Gets Logged

| Event | `type` | `status` |
|-------|--------|----------|
| Helix purchase success | `helix` | `succeeded` |
| Helix purchase failure | `helix` | `failed` |
| Subscription created | `novel_subscription` | `succeeded` |
| Subscription renewed | `novel_subscription` | `succeeded` (with `metadata.renewal: true`) |
| Subscription cancelled | `novel_subscription` | `cancelled` |
| Payment failure | varies | `failed` (with `error_message`, `error_code`) |
| PayPal refund | `refund` | `refunded` |

### Log Fields

Each log row includes:
- **Provider details**: `payment_provider`, `provider_transaction_id`, `provider_subscription_id`, `provider_customer_id`
- **Purchase details**: `helix_amount`, `novel_id`, `subscription_id`
- **Payment method**: `payment_method_type` (card/paypal/link), `payment_method_brand` (visa/mastercard), `payment_method_last4`
- **Event tracking**: `event_type` (the webhook event that triggered this log)
- **Error tracking**: `error_message`, `error_code`
- **Raw data**: `metadata` (JSONB), `raw_data` (full provider response)
- **Timestamps**: `created_at`, `processed_at`

### User-Facing Transaction History

| Endpoint | Purpose |
|----------|---------|
| `GET /api/transactions` | Paginated transaction list (from `user_transaction_history` view) |
| `GET /api/transactions/summary` | Aggregate: total spent, total helix purchased, transaction count |

---

## Environment Configuration

### Single Toggle

Set `PAYMENT_ENV` in your `.env` to control development vs production mode:

| Value | Mode | Tables Used | PayPal API |
|-------|------|-------------|------------|
| `dev`, `test`, `sandbox` | Development | `dev_helix_packs`, `dev_subscription_plans` | `api-m.sandbox.paypal.com` |
| `live` (default) | Production | `helix_packs`, `subscription_plans` | `api-m.paypal.com` |

Falls back to checking `STRIPE_ENV` and `PAYPAL_ENV` for backward compatibility.

The `isDev` boolean from `src/lib/environment-utils.ts` is the single source of truth.

### Required Environment Variables

```bash
# Payment environment
PAYMENT_ENV=live                            # 'dev' for sandbox/test mode

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx               # or sk_test_xxx for dev
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# PayPal
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
NEXT_PUBLIC_PAYPAL_CLIENT_ID=xxx
PAYPAL_WEBHOOK_ID=xxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# App
NEXT_PUBLIC_APP_URL=https://genesisnovels.com
```

When `PAYMENT_ENV=dev`, the `getEnvironmentVariable()` helper will also look for `_DEV` suffixed env vars (e.g., `STRIPE_WEBHOOK_SECRET_DEV`).

---

## API Route Map

### Payment Provider Routes

```
/api/stripe/
  customer/ensure                    POST   Ensure Stripe customer exists
  helix/create-checkout-session      POST   Create Stripe Checkout for helix purchase
  helix/create-payment-intent        POST   Create PaymentIntent (legacy, for embedded Elements)
  helix/ensure-products              POST   Ensure Stripe products exist for all packs
  subscriptions/create-checkout-session  POST   Create Stripe Checkout for subscription
  subscriptions/create-subscription  POST   Create direct Stripe subscription
  subscriptions/ensure-plan/[novelId]  POST   Ensure Stripe plan exists for novel
  sync                               POST   Sync all Stripe subscriptions to local DB

/api/paypal/
  customer/ensure                    POST   Ensure PayPal customer record exists
  helix/create-order                 POST   Create PayPal order for helix purchase
  helix/capture                      POST   Capture approved PayPal helix order
  subscriptions/create               POST   Initialize PayPal subscription flow
  subscriptions/create-plan/[novelId]  POST   Create PayPal plan for novel
```

### Webhook Routes

```
/api/webhooks/
  stripe                             POST   Stripe webhook handler
  paypal                             POST   PayPal webhook handler
```

### User-Facing Routes

```
/api/helix-packs                     GET    List active helix packs from DB
/api/chapters/unlock                 POST   Unlock chapter(s) with Helix
/api/novel-subscription              GET    Check subscription status for a novel
                                     POST   Create subscription record
/api/subscriptions                   GET    List user's active subscriptions
/api/wallet/balance                  GET    Get wallet balance
                                     POST   Add helix to wallet
/api/transactions                    GET    Paginated transaction history
/api/transactions/summary            GET    Spending summary
/api/unlocked/chapters               GET    List purchased chapters
/api/unlocked/subscriptions          GET    List active subscriptions
```

### Admin Routes

```
/api/admin/
  provision-all                      POST   Provision all packs + plans (replaces CLI scripts)
  provision-novel-plan               POST   Provision single novel's Stripe + PayPal plan
  provision-helix-packs              POST   Provision all helix pack products
```

---

## Database Tables

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `wallets` | User Helix + Atoms balance | `user_id` (unique), `helix`, `atoms` |
| `subscriptions` | Active/cancelled novel subscriptions | `user_id`, `novel_id` (unique together), `status`, `start_date`, `end_date`, `stripe_subscription_id`, `paypal_subscription_id` |
| `chapter_purchases` | Record of unlocked chapters | `user_id`, `chapter_id` (unique together), `novel_id`, `helix_spent` |
| `payment_customers` | Provider customer ID mapping | `user_id` (unique), `stripe_customer_id`, `paypal_customer_id` |
| `payment_logs` | Full transaction audit trail | `user_id`, `type`, `payment_provider`, `provider_transaction_id`, `status`, `amount_cents`, `metadata`, `raw_data` |
| `paypal_subscription_pending` | Temp mapping for PayPal subscription webhooks | `user_id`, `novel_id` (unique together), `plan_id` |

### Product Catalog Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `helix_packs` | Helix bundle definitions (production) | `name`, `helix_amount`, `bonus_amount`, `helix_total`, `price_cents`, `stripe_product_id`, `stripe_price_id`, `paypal_product_id` |
| `dev_helix_packs` | Helix bundle definitions (development) | Same schema |
| `subscription_plans` | Per-novel subscription plans (production) | `novel_id` (unique), `price_cents`, `stripe_product_id`, `stripe_price_id`, `paypal_product_id`, `paypal_plan_id` |
| `dev_subscription_plans` | Per-novel subscription plans (development) | Same schema |

### Views & Functions

| Name | Type | Purpose |
|------|------|---------|
| `user_transaction_history` | View | Filtered payment_logs for user-facing display |
| `get_user_total_spending(user_id)` | Function | Returns total spent, helix purchased, transaction count |

The canonical schema is in `db/schema.sql` in the genesis-site repo.

---

## Library Files

| File | Purpose |
|------|---------|
| `src/lib/stripe.ts` | Server-side Stripe client (`stripe`) and client-side `stripePromise` for Elements |
| `src/lib/paypal.ts` | Full PayPal REST wrapper: OAuth token management, product/plan/order CRUD, subscription management, webhook signature verification |
| `src/lib/environment-utils.ts` | Single `isDev` toggle, table name helpers (`getHelixPacksTable`, `getSubscriptionPlansTable`), env-aware variable loading |
| `src/lib/helix-icons.ts` | Helix pack icon URLs and color schemes for Stripe product images |
| `src/lib/auth-utils.ts` | Session validation, user data extraction, corruption handling |
| `src/types/payment.ts` | TypeScript types: `PaymentStatus`, `PaymentType`, `PaymentProvider`, `PaymentLog`, `TransactionHistoryItem` |

### Frontend Hooks

| Hook | Purpose |
|------|---------|
| `src/hooks/useHelixPacks.ts` | Fetches helix packs from `/api/helix-packs` with caching |
| `src/hooks/usePaymentButtonSync.ts` | Synchronizes payment button state across Stripe/PayPal options |
| `src/hooks/useWallet.ts` | Wallet state: helix balance, fetch/add/unlock methods, 5-minute cache |

---

## Security

### Webhook Signature Verification

Both providers verify webhook authenticity before processing:

- **Stripe**: `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)` — rejects invalid/missing signatures with `400`
- **PayPal**: `verifyWebhookSignature()` calls PayPal's Notification Verification API using `PAYPAL_WEBHOOK_ID` — rejects unverified events

### Idempotency

Every webhook handler checks for duplicate events before mutating state:

- **Helix payments**: Query `payment_logs` by `(payment_provider, provider_transaction_id)`
- **Subscription events**: Query `payment_logs` by `(payment_provider, provider_subscription_id, event_type)`

Duplicates return `{ received: true }` without re-processing.

### Server-Side Payment Creation

- PaymentIntents, Checkout Sessions, and Orders are created in API routes — never on the client
- The client only receives a session URL or client secret
- Prices and Helix amounts are read from the database server-side — the client cannot manipulate amounts
- Helix balance validation happens server-side before deduction

### Service Role for Webhooks

Webhook handlers use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) because they are not authenticated by a user session. All other API routes use the anon key with Bearer token auth.

### Transaction Integrity

Chapter unlock includes a compensating transaction: if the `chapter_purchases` insert fails after helix was deducted, the helix is added back to the wallet.

---

## Cross-References

- **[02 — Database Schema](./02-Database-Schema.md):** Full table schemas for all payment tables
- **[03 — Directus CMS Integration](./03-Directus-CMS-Integration.md):** Novel data boundaries — `novel_id` UUIDs that bridge Directus and Supabase
- **[04 — API Reference](./04-API-Reference.md):** Request/response formats for all payment endpoints
- **[12 — UI: Chapter Viewer](./12-UI-Chapter-Viewer.md):** Locked chapter UI that triggers unlock/subscription flows
- **[14 — UI: Store](./14-UI-Store.md):** Store tabs, Helix bundle cards, and subscription cards

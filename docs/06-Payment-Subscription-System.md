---
id: "06-Payment-Subscription-System"
slug: "/06-Payment-Subscription-System"
sidebar_position: 6
sidebar_label: "Payment & Subscription System"
---

# 06 — Payment & Subscription System

> Dual monetization through Helix virtual currency and novel subscriptions, powered by Stripe and PayPal.

---

## Table of Contents

- [System Overview](#system-overview)
- [Helix Virtual Currency](#helix-virtual-currency)
- [Chapter Unlock Flow](#chapter-unlock-flow)
- [Subscriptions](#subscriptions)
- [Stripe Integration](#stripe-integration)
- [PayPal Integration](#paypal-integration)
- [Modal Payment Flow](#modal-payment-flow)
- [Payment Success Page](#payment-success-page)
- [Database Tables Summary](#database-tables-summary)
- [Security](#security)
- [Cross-References](#cross-references)

---

## System Overview

Genesis Studio uses a **dual monetization model**:

| Model | Mechanism | Scope |
|-------|-----------|-------|
| **Helix** (virtual currency) | Buy Helix packs with real money, spend Helix to unlock individual chapters | Per-chapter |
| **Novel Subscriptions** | Monthly subscription unlocks all chapters of a novel | Per-novel |

Both models are supported by **two payment providers**:

| Provider | Used For | Client Library |
|----------|----------|----------------|
| **Stripe** | PaymentIntents (Helix), Subscriptions | `@stripe/react-stripe-js`, Stripe Elements |
| **PayPal** | Helix purchases, Subscriptions | PayPal REST API |

### Environment Awareness

Payment tables are environment-aware. The `STRIPE_ENV` and `PAYPAL_ENV` environment variables switch between development and production database tables:

| Environment | Helix Packs Table | Subscription Plans Table |
|-------------|-------------------|--------------------------|
| `dev` / `test` | `dev_helix_packs` | `dev_subscription_plans` |
| `live` / `production` | `helix_packs` | `subscription_plans` |

This separation ensures test transactions never pollute production data.

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
| `user_id` | UUID | Unique constraint — one wallet per user |
| `helix` | integer | Default: 0 |

### Helix Packs

Five predefined packs are available for purchase:

| Pack | Helix | Bonus | Total Helix | Price (USD) |
|------|-------|-------|-------------|-------------|
| Starter | 600 | — | 600 | $9.99 |
| Popular | 1,600 | +100 | 1,700 | $24.99 |
| Value | 3,500 | +300 | 3,800 | $49.99 |
| Premium | 5,900 | +600 | 6,500 | $74.99 |
| Ultimate | 9,300 | +1,000 | 10,300 | $99.99 |

Packs are stored in `helix_packs` (production) or `dev_helix_packs` (development), selected by the `STRIPE_ENV` environment variable.

### Purchase Flow

```
User selects a Helix pack
  → HelixPurchaseContent modal opens
  → Stripe PaymentIntent created via /api/create-helix-payment-intent
  → User completes payment in Stripe Elements (CheckoutForm)
  → Stripe webhook fires (payment_intent.succeeded)
  → Webhook handler credits Helix to user's wallet
  → Payment logged to payment_logs table
```

---

## Chapter Unlock Flow

### Sequential Unlock Enforcement

Chapters must be unlocked **in order**. A user cannot unlock Chapter 5 without owning all previous paid chapters (1-4). This is enforced server-side by the `/api/chapters/unlock` endpoint.

### Cost

Each chapter unlock costs **100 Helix**, stored in the `chapter_purchases.helix_cost` column.

### Flow

```
User clicks a locked chapter
  → UnlockOptionsContent modal opens (choose: Helix unlock or subscription)
  
  If Helix unlock:
    → HelixUnlockContent modal opens
    → Shows: cost (100 Helix), current balance, list of required sequential chapters
    → User clicks "Confirm Unlock"
    → POST /api/chapters/unlock
    → Server validates:
      1. User has sufficient Helix balance
      2. User owns all previous paid chapters (sequential check)
    → Helix deducted from wallet
    → chapter_purchases record created
    → Chapter content now accessible
  
  If insufficient balance:
    → InsufficientHelixContent modal opens
    → Shows "Not enough Helix" message
    → Link to Helix store to purchase more
```

### Unlock API

```
POST /api/chapters/unlock
Body: { chapterId, novelId }

Validations:
  1. User is authenticated
  2. Chapter exists and is a paid chapter
  3. User owns all previous paid chapters in the novel
  4. User has >= 100 Helix in wallet

On success:
  - Deducts 100 Helix from wallet
  - Creates chapter_purchases record (user_id, chapter_id, novel_id, helix_cost)
  - Returns updated balance
```

---

## Subscriptions

### Platform-Wide Subscriptions (Luminary)

Platform-level subscription plans are stored in:

- `subscription_plans` (production)
- `dev_subscription_plans` (development)

Selected by the `STRIPE_ENV` environment variable.

### Novel-Specific Subscriptions

Per-novel subscriptions are stored in the `subscriptions` table:

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID | FK to user |
| `novel_id` | UUID | FK to novel |
| `status` | string | active, cancelled, expired, etc. |
| `start_date` | timestamp | Subscription start |
| `end_date` | timestamp | Current period end |
| `payment_provider` | string | `stripe` or `paypal` |
| `provider_subscription_id` | string | External subscription ID |

**Unique constraint:** `(user_id, novel_id)` — a user can have at most one active subscription per novel.

### What Subscriptions Grant

A novel subscription grants access to **ALL chapters** of that novel, regardless of whether they are marked as paid. No Helix is required for subscribers.

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/create-subscription` | Create a platform-wide (Luminary) subscription |
| `/api/create-novel-subscription` | Create a novel-specific subscription |

---

## Stripe Integration

### Configuration

**File:** `src/lib/stripe.ts`

```ts
import Stripe from "stripe";

// Initializes with live or dev secret key based on STRIPE_ENV
const stripe = new Stripe(
  STRIPE_ENV === "live" ? STRIPE_SECRET_KEY : STRIPE_TEST_SECRET_KEY
);
```

### Client-Side

The `@stripe/react-stripe-js` library provides Stripe Elements for secure payment form rendering. The `CheckoutForm` component handles the payment UI.

### PaymentIntents (Helix Purchases)

```
Client: User selects Helix pack
  → POST /api/create-helix-payment-intent { packId, userId }
  → Server creates Stripe PaymentIntent with amount from pack
  → Returns { clientSecret }
  
Client: CheckoutForm receives clientSecret
  → Renders Stripe Elements (card input)
  → User enters card details
  → stripe.confirmPayment({ clientSecret })
  → Stripe processes payment
  → Webhook fires on success
```

### Webhooks

**Endpoint:** `/api/webhooks/stripe`

The webhook handler verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET` before processing any event.

| Event | Handler Action |
|-------|---------------|
| `payment_intent.succeeded` | Credits Helix to user's wallet, logs payment to `payment_logs` |
| `invoice.payment_succeeded` | Handles subscription renewal — extends subscription `end_date` |
| `customer.subscription.deleted` | Marks subscription as `cancelled` in `subscriptions` table |

### Webhook Signature Verification

```ts
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  STRIPE_WEBHOOK_SECRET
);
```

If verification fails, the endpoint returns a `400` response and the event is not processed.

---

## PayPal Integration

### Plan Provisioning

PayPal subscription plans are provisioned via a setup script:

```bash
node scripts/provision-paypal-plans.js
```

This script creates the corresponding PayPal billing plans for each subscription tier.

### Webhooks

**Endpoint:** `/api/webhooks/paypal`

| Event | Handler Action |
|-------|---------------|
| `PAYMENT.CAPTURE.COMPLETED` | Credits Helix to user's wallet |
| `BILLING.SUBSCRIPTION.ACTIVATED` | Creates/activates subscription in `subscriptions` table |
| `BILLING.SUBSCRIPTION.CANCELLED` | Marks subscription as `cancelled` |

---

## Modal Payment Flow

### ModalViewboxContext

**File:** `src/app/context/ModalViewboxContext.tsx`

The payment flow uses a **stack-based modal system** for seamless navigation between payment steps.

#### Stack Operations

| Operation | Behavior |
|-----------|----------|
| `openModal(type, props)` | Pushes a new modal onto the stack |
| `goBack()` | Pops the top modal, revealing the previous one |
| `close()` | Clears the entire stack, closing all modals |

#### Modal Types

| Type | Component | Purpose |
|------|-----------|---------|
| `unlock-options` | `UnlockOptionsContent` | Choose between Helix unlock or subscription |
| `helix-unlock` | `HelixUnlockContent` | Confirm Helix chapter unlock |
| `insufficient-helix` | `InsufficientHelixContent` | "Not enough Helix" with store link |
| `helix-purchase` | `HelixPurchaseContent` | Stripe Elements checkout for Helix packs |
| `novel-subscription` | `NovelSubscriptionContent` | Novel subscription purchase |

### ModalViewbox Component

**File:** `src/app/components/payment/ModalViewbox.tsx`

Rendered at the **root layout level** so it overlays the entire application. Displays the modal at the top of the stack. Supports animated transitions between stack states.

### Modal Contents

**Directory:** `src/app/components/payment/ModalContents/`

#### UnlockOptionsContent

Presents the user with a choice:

- **Helix Unlock:** Spend 100 Helix to unlock this chapter.
- **Novel Subscription:** Subscribe monthly to unlock all chapters.

#### HelixUnlockContent

Displays:

- Chapter title and cost (100 Helix).
- Current wallet balance.
- List of required sequential chapters (if any must be unlocked first).
- "Confirm Unlock" button.

#### InsufficientHelixContent

Shown when the user's Helix balance is below the unlock cost:

- "Not enough Helix" message.
- Current balance display.
- Link/button to navigate to the Helix store.

#### HelixPurchaseContent

Helix pack purchase UI:

- Renders Stripe Elements via `CheckoutForm`.
- Pack selection with pricing.
- Handles payment confirmation and error display.

#### NovelSubscriptionContent

Novel subscription purchase:

- Displays novel cover art and title.
- Subscription tier options with pricing.
- Payment form integration.

### CheckoutForm

**File:** `src/components/payment/CheckoutForm.tsx`

The `CheckoutForm` component integrates Stripe Elements:

- Renders the Stripe card input element.
- Handles `stripe.confirmPayment()` on form submission.
- Displays payment errors inline.
- Shows loading state during payment processing.
- Calls success callback on completion.

---

## Payment Success Page

**Route:** `/payment/success`

A simple confirmation page shown after successful payment:

- Success message confirming the transaction.
- "Go to Profile" button for navigation.
- Minimal UI — serves as a landing page after payment provider redirects.

---

## Database Tables Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `wallets` | User Helix balance | `user_id` (unique), `helix` (int, default 0) |
| `chapter_purchases` | Record of unlocked chapters | `user_id`, `chapter_id`, `novel_id`, `helix_cost` |
| `subscriptions` | Active/cancelled subscriptions | `user_id`, `novel_id`, `status`, `start_date`, `end_date`, `payment_provider`, `provider_subscription_id` |
| `helix_packs` | Production Helix pack definitions | `id`, `name`, `helix_amount`, `bonus`, `price` |
| `dev_helix_packs` | Development Helix pack definitions | Same schema as `helix_packs` |
| `subscription_plans` | Production subscription plans | Plan tiers and pricing |
| `dev_subscription_plans` | Development subscription plans | Same schema as `subscription_plans` |
| `payment_logs` | Transaction audit trail | `user_id`, `type`, `provider`, `amount`, `status`, `metadata` |
| `payment_customers` | Provider customer ID mapping | `user_id`, `stripe_customer_id`, `paypal_customer_id` |

For full schema details, see [02 — Database Schema](./02-Database-Schema.md).

---

## Security

### Webhook Signature Verification

Both Stripe and PayPal webhooks verify request authenticity before processing:

- **Stripe:** `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)` — rejects requests with invalid or missing signatures.
- **PayPal:** Webhook verification via PayPal's notification verification API.

### Server-Side Payment Creation

All payment creation happens server-side:

- PaymentIntents are created in API routes, never on the client.
- The client only receives the `clientSecret` needed to confirm payment.
- Pack prices and Helix amounts are read from the database server-side — the client cannot manipulate amounts.

### Transaction Logging

Every payment event is recorded in the `payment_logs` table:

- Payment type (helix_purchase, subscription, etc.)
- Provider (stripe, paypal)
- Amount and currency
- Status (succeeded, failed, refunded)
- Full metadata for audit trails

---

## Cross-References

- **[02 — Database Schema](./02-Database-Schema.md):** Full table schemas for wallets, chapter_purchases, subscriptions, and payment tables.
- **[03 — Directus CMS Integration](./03-Directus-CMS-Integration.md):** Content and profile data boundaries that payment flows interact with.
- **[12 — UI: Chapter Viewer](./12-UI-Chapter-Viewer.md):** Reader access checks and the locked-chapter UI that triggers unlock/subscription flows.
- **[14 — UI: Store](./14-UI-Store.md):** Store tabs, Helix bundles, and subscription cards that launch checkout.

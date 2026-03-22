---
id: "19-Scripts-Development-Setup"
slug: "/19-Scripts-Development-Setup"
sidebar_position: 19
sidebar_label: "Scripts & Development Setup"
---

# 19 — Scripts & Development Setup

> How to set up a local development environment, run utility scripts, build, deploy, and troubleshoot the Genesis Studio web novel platform.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [NPM Scripts](#2-npm-scripts)
3. [Utility Scripts](#3-utility-scripts)
4. [Environment Setup](#4-environment-setup)
5. [Database Setup](#5-database-setup)
6. [Directus CMS Setup](#6-directus-cms-setup)
7. [Development Workflow](#7-development-workflow)
8. [Deployment (Vercel)](#8-deployment-vercel)
9. [Troubleshooting](#9-troubleshooting)
10. [Cross-References](#10-cross-references)

---

## 1. Quick Start

### Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| Node.js | 18+ | LTS recommended |
| npm | Bundled with Node | Used for dependency management |
| Supabase account | — | Free tier works for development |
| Directus instance | — | Self-hosted or cloud (e.g., `edit.genesistudio.com`) |
| Stripe account | — | Use **test mode** for development |
| PayPal developer account | — | Sandbox credentials for development |

### Setup Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd genesis-site

# 2. Install dependencies
npm install

# 3. Create environment file
#    No .env.example file exists — create .env.local manually.
#    See Section 4 below or doc 01 (Architecture Overview) for all variables.
touch .env.local

# 4. Fill in all 24 environment variables in .env.local
#    (See Section 4 for details on obtaining each value)

# 5. Start the development server with Turbopack
npm run dev
# → http://localhost:3000

# 6. (Optional) Seed the database with sample data
node scripts/setup-dev-environment.js
node scripts/populate-dev-tables.js
```

After `npm run dev`, the site is available at **http://localhost:3000** with Turbopack providing fast refresh on file changes.

---

## 2. NPM Scripts

All scripts are defined in `package.json`. Run them with `npm run <script>`.

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev --turbopack` | Start the development server with Turbopack for fast refresh |
| `build` | `next build --turbopack` | Create a production-optimized build with Turbopack |
| `start` | `next start` | Start the production server (run `build` first) |
| `lint` | `eslint` | Run ESLint across the project using the flat config |
| `cleanup-stripe` | `node scripts/cleanup-stripe-products.js` | Remove old/unused Stripe products and prices |
| `cleanup-stripe-enhanced` | `node scripts/cleanup-stripe-products-enhanced.js` | Enhanced Stripe cleanup with edge case handling |
| `preview-stripe-cleanup` | `node scripts/preview-stripe-cleanup.js` | Dry-run preview — shows what cleanup would delete |
| `provision-paypal-plans` | `node scripts/provision-paypal-plans.js` | Create PayPal subscription plans matching Stripe plans |

### Common Workflows

```bash
# Development
npm run dev                    # Start dev server
npm run lint                   # Check for lint errors

# Production
npm run build                  # Build for production
npm run start                  # Serve the production build

# Payment setup (run once)
node scripts/init-dev-helix-packs.js
node scripts/init-dev-subscription-plans.js
npm run provision-paypal-plans

# Payment cleanup
npm run preview-stripe-cleanup # Check what would be removed
npm run cleanup-stripe         # Actually remove old products
```

---

## 3. Utility Scripts

All utility scripts live in the `scripts/` directory and are run directly with `node`.

### 3.1 Setup & Seeding

#### `setup-dev-environment.js`

Sets up the complete development environment in a single run:

- Creates required Supabase tables (wallets, purchases, subscriptions, etc.)
- Initializes Stripe products and prices in test mode
- Provisions PayPal subscription plans

**Run once** when setting up a new development environment.

```bash
node scripts/setup-dev-environment.js
```

#### `populate-dev-tables.js`

Seeds the development database with sample data:

- Sample novels and chapters in Directus
- Test user profiles
- Example wallet balances and transaction history

Useful for local development and testing when you need realistic data to work with.

```bash
node scripts/populate-dev-tables.js
```

### 3.2 Stripe Product Management

Genesis Studio maintains parallel sets of Stripe products for development (test mode) and production (live mode). The scripts below create and manage these products.

#### `init-helix-packs.js`

Creates **production** Helix pack products and prices in Stripe.

- Defines the 5 Helix tiers with correct pricing
- Creates Stripe Product and Price objects for each tier
- Updates the `helix_packs` table in Supabase with the corresponding Stripe price IDs

```bash
node scripts/init-helix-packs.js
```

#### `init-dev-helix-packs.js`

Same as above but targets **Stripe test mode**.

- Creates products/prices in the Stripe test environment
- Updates the `dev_helix_packs` table

```bash
node scripts/init-dev-helix-packs.js
```

#### `init-subscription-plans.js`

Creates **production** Luminary subscription plans in Stripe with recurring pricing.

- Defines monthly and annual Luminary tiers
- Creates Stripe Products with recurring Prices
- Updates the `subscription_plans` table with Stripe price IDs

```bash
node scripts/init-subscription-plans.js
```

#### `init-dev-subscription-plans.js`

Same as above but targets **Stripe test mode**.

- Creates recurring products/prices in the Stripe test environment
- Updates the `dev_subscription_plans` table

```bash
node scripts/init-dev-subscription-plans.js
```

#### `cleanup-stripe-products.js`

Removes old or unused Stripe products and their associated prices. Use this when resetting your payment configuration or after schema changes.

```bash
node scripts/cleanup-stripe-products.js
```

#### `cleanup-stripe-products-enhanced.js`

Enhanced version of the cleanup script with more thorough handling:

- Handles archived products
- Cleans up orphaned prices
- Deals with edge cases (products with active subscriptions, etc.)

```bash
node scripts/cleanup-stripe-products-enhanced.js
```

#### `preview-stripe-cleanup.js`

**Dry run** — shows exactly what `cleanup-stripe-products.js` would delete without actually performing any deletions. Always run this first to verify before cleaning up.

```bash
node scripts/preview-stripe-cleanup.js
```

### 3.3 PayPal

#### `provision-paypal-plans.js`

Creates PayPal subscription plans that mirror the Stripe subscription plans:

- Creates PayPal Products and Billing Plans for each Luminary tier
- Registers the PayPal plan IDs in the database

This must be run **after** the Stripe subscription plans are created, as it reads plan details from the database.

```bash
node scripts/provision-paypal-plans.js
```

### 3.4 Utility

#### `reset-ids.js`

Resets auto-increment IDs on specified database tables. Useful after bulk data cleanup or when you want to restart ID sequences from 1.

```bash
node scripts/reset-ids.js
```

### Script Summary Table

| Script | Environment | Idempotent | Side Effects |
|--------|-------------|------------|--------------|
| `setup-dev-environment.js` | Development | Yes (creates if not exists) | Creates Supabase tables, Stripe products, PayPal plans |
| `populate-dev-tables.js` | Development | No (may duplicate) | Inserts sample data |
| `init-helix-packs.js` | Production | No | Creates Stripe products, updates Supabase |
| `init-dev-helix-packs.js` | Development | No | Creates Stripe test products, updates Supabase |
| `init-subscription-plans.js` | Production | No | Creates Stripe products, updates Supabase |
| `init-dev-subscription-plans.js` | Development | No | Creates Stripe test products, updates Supabase |
| `cleanup-stripe-products.js` | Both | Yes | Deletes Stripe products |
| `cleanup-stripe-products-enhanced.js` | Both | Yes | Deletes Stripe products (thorough) |
| `preview-stripe-cleanup.js` | Both | Yes | Read-only (dry run) |
| `provision-paypal-plans.js` | Both | No | Creates PayPal plans, updates Supabase |
| `reset-ids.js` | Both | Yes | Resets DB sequences |

---

## 4. Environment Setup

### No `.env.example` File

Genesis Studio does not ship a `.env.example` file. You must create `.env.local` manually and populate all required variables. See [doc 01 — Architecture Overview](./01-Architecture-Overview.md) for the complete table of all **24 environment variables**.

### Obtaining Credentials

#### Supabase

1. Go to [app.supabase.com](https://app.supabase.com) and select your project
2. Navigate to **Settings → API**
3. Copy the following:

| Variable | Where to Find |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g., `https://abcdefgh.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (keep secret) |
| `NEXT_PUBLIC_SUPABASE_STORAGE_API` | `{SUPABASE_URL}/storage/v1/object/public` |

#### Directus

| Variable | Where to Find |
|----------|---------------|
| `NEXT_PUBLIC_DIRECTUS_URL` | Your Directus instance URL (e.g., `https://edit.genesistudio.com`) |
| `DIRECTUS_TOKEN` | Settings → Admin Token, or create a static token for a dedicated API user |

#### Stripe

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Navigate to **Developers → API keys**
3. For webhooks: **Developers → Webhooks → Add endpoint**

| Variable | Where to Find |
|----------|---------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable key (starts with `pk_test_` or `pk_live_`) |
| `STRIPE_SECRET_KEY` | Secret key (starts with `sk_test_` or `sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (starts with `whsec_`) |
| `STRIPE_ENV` | Set to `"development"` for test keys, `"production"` for live keys |

#### PayPal

1. Go to [developer.paypal.com](https://developer.paypal.com)
2. Navigate to **Apps & Credentials**

| Variable | Where to Find |
|----------|---------------|
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Client ID from your app |
| `PAYPAL_CLIENT_SECRET` | Secret from your app |
| `PAYPAL_WEBHOOK_ID` | Created under Webhooks in your app settings |
| `PAYPAL_ENV` | Set to `"development"` for sandbox, `"production"` for live |

### Environment Mode Switching

The `STRIPE_ENV` and `PAYPAL_ENV` variables control which payment environment is active:

```
# Development (test/sandbox)
STRIPE_ENV=development
PAYPAL_ENV=development

# Production (live payments)
STRIPE_ENV=production
PAYPAL_ENV=production
```

When set to `"development"`, the app reads from `dev_helix_packs` and `dev_subscription_plans` tables. When set to `"production"`, it reads from `helix_packs` and `subscription_plans`.

---

## 5. Database Setup

Genesis Studio uses two database systems. Tables are managed differently depending on which system owns them.

### Supabase (User & Commerce Data)

**Create a project** at [app.supabase.com](https://app.supabase.com).

Tables managed by Supabase include user-related and commerce tables:

- `wallets` — User Helix balances
- `wallet_transactions` — Helix transaction history
- `purchases` — Chapter purchases
- `subscriptions` — Luminary subscription records
- `helix_packs` / `dev_helix_packs` — Stripe product/price mappings
- `subscription_plans` / `dev_subscription_plans` — Stripe subscription plan mappings

These tables are created by running the setup script:

```bash
node scripts/setup-dev-environment.js
```

To populate with sample data:

```bash
node scripts/populate-dev-tables.js
```

### Directus (Content Data)

Content tables are created and managed through the Directus admin panel:

- `novels` — Novel metadata, covers, synopses
- `chapters` — Chapter content and ordering
- `genres` — Genre taxonomy
- `announcements` — Platform announcements

See [doc 03 — Directus CMS Integration](./03-Directus-CMS-Integration.md) for the complete schema definition and collection setup.

---

## 6. Directus CMS Setup

### Hosting

Host a Directus instance — either self-hosted or via Directus Cloud. The production instance lives at `edit.genesistudio.com`.

### Initial Configuration

1. **Create required collections** matching the `Schema` TypeScript interface defined in the codebase (see [doc 03](./03-Directus-CMS-Integration.md)):
   - `novels` — with fields: title, abbreviation, synopsis, cover_image, author, genres, status, etc.
   - `chapters` — with fields: title, content, novel (relation), order, access_level, status, etc.
   - `genres` — with fields: name, slug
   - `announcements` — with fields: title, content, date, status

2. **Generate an admin token** for server-side API access:
   - Go to Directus Settings → Access Tokens
   - Create a static token with read access to all content collections
   - Set this as `DIRECTUS_TOKEN` in `.env.local`

3. **Configure file storage** to sync with Supabase Storage if you want uploaded images accessible through the Supabase CDN.

---

## 7. Development Workflow

### Linting

ESLint is configured via `eslint.config.mjs` using the **flat config** format:

```javascript
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
```

Run the linter:

```bash
npm run lint
```

### TypeScript

The project uses strict TypeScript. Key settings from `tsconfig.json`:

| Setting | Value | Notes |
|---------|-------|-------|
| `strict` | `true` | Full strict mode enabled |
| `target` | `ES2017` | Modern JS output |
| `moduleResolution` | `bundler` | Next.js bundler resolution |
| `paths` | `{ "@/*": ["./src/*"] }` | Import alias — `@/components/Foo` resolves to `src/components/Foo` |

### Building

```bash
npm run build
```

The build uses Turbopack and performs:

- Full TypeScript type checking
- Next.js route compilation
- Static page generation (where applicable)
- Build warnings/errors are surfaced in the terminal

### Hot Reload

During development, Turbopack provides near-instant hot module replacement. File saves trigger:

- React Fast Refresh for component changes
- Full page reload for layout/server component changes
- CSS updates without page reload

---

## 8. Deployment (Vercel)

### Automatic Deployment

Genesis Studio is deployed on Vercel with GitHub integration:

- **Push to `main`** triggers an automatic production build and deployment
- **Pull requests** create preview deployments with unique URLs

### Build Configuration

| Setting | Value |
|---------|-------|
| Framework | Next.js (auto-detected) |
| Build command | `next build --turbopack` |
| Output directory | `.next/` |
| Node.js version | 18.x |

### Environment Variables

All 24 environment variables must be set in the Vercel project settings (**Settings → Environment Variables**). Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser; all others are server-only.

### Post-Deployment Checklist

After deploying to production, verify the following:

- [ ] **Environment variables** — All 24 variables set in Vercel project settings
- [ ] **Stripe webhook** — Endpoint URL: `https://genesistudio.com/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] **PayPal webhook** — Endpoint URL: `https://genesistudio.com/api/webhooks/paypal`
  - Events: `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `PAYMENT.SALE.COMPLETED`
- [ ] **Directus API** — Accessible from Vercel's server functions (no firewall blocking)
- [ ] **Supabase project** — Accessible and tables created
- [ ] **Cloudflare CDN** — Configured if using image transforms (see [doc 07](./07-Image-Pipeline.md))
- [ ] **DNS** — `genesistudio.com` pointing to Vercel
- [ ] **SSL** — HTTPS working (Vercel provides this automatically)

---

## 9. Troubleshooting

### Common Issues

#### "DIRECTUS_TOKEN not configured" Warning

**Cause:** The `DIRECTUS_TOKEN` environment variable is missing or empty.

**Fix:** Add it to `.env.local`:

```bash
DIRECTUS_TOKEN=your-directus-admin-token-here
```

---

#### Stripe Webhook Failures (Local Development)

**Cause:** Stripe cannot reach `localhost:3000` to deliver webhook events.

**Fix:** Use the Stripe CLI to forward events locally:

```bash
# Install Stripe CLI, then:
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# The CLI will print a webhook signing secret (whsec_...)
# Set it as STRIPE_WEBHOOK_SECRET in .env.local
```

---

#### PayPal Webhook Failures

**Cause:** PayPal sandbox webhooks cannot reach localhost.

**Fix:** Use PayPal sandbox mode for development. Webhook verification is handled server-side — ensure `PAYPAL_WEBHOOK_ID` matches the webhook configured in the PayPal developer dashboard.

---

#### Image Loading Errors

**Cause:** Images not rendering or returning 404.

**Checklist:**
1. Verify `NEXT_PUBLIC_SUPABASE_STORAGE_API` is set correctly (should end with `/storage/v1/object/public`)
2. Confirm the file exists in Supabase Storage
3. Check the bucket's public access settings in Supabase dashboard
4. Verify the image path in Directus matches the Supabase Storage path

---

#### Auth Redirect Loops

**Cause:** After login, the user is redirected back to the login page in an infinite loop.

**Checklist:**
1. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
2. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
3. Check that the Supabase project's **Site URL** and **Redirect URLs** are configured:
   - Site URL: `http://localhost:3000` (dev) or `https://genesistudio.com` (prod)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://genesistudio.com/auth/callback`

---

#### Build Failures

**Cause:** TypeScript errors or missing dependencies.

**Common fixes:**

```bash
# Check for type errors without building
npx tsc --noEmit

# Clear the Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules && npm install

# Rebuild
npm run build
```

TypeScript strict mode catches many issues. Common culprits:
- Missing type definitions for third-party modules
- Implicit `any` types in function parameters
- Nullable values accessed without null checks

---

#### CORS Errors

**Cause:** API requests blocked by browser CORS policy.

**Fix:** The middleware (`src/middleware.ts` / proxy configuration) adds CORS headers to API responses. Check:

1. The middleware matcher pattern includes the affected routes
2. The `Access-Control-Allow-Origin` header matches the requesting domain
3. Preflight `OPTIONS` requests are handled

---

#### Turbopack-Specific Issues

If you encounter unexpected behavior during development with Turbopack:

```bash
# Fall back to webpack dev server
npx next dev    # (without --turbopack)
```

This can help isolate whether the issue is Turbopack-specific or a general application bug.

---

### Diagnostic Commands

```bash
# Check Node.js version
node --version           # Should be 18+

# Check environment variables are loaded
node -e "require('dotenv').config({ path: '.env.local' }); console.log(Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('STRIPE') || k.includes('DIRECTUS') || k.includes('PAYPAL')))"

# Test Directus connectivity
curl -s -o /dev/null -w "%{http_code}" "$NEXT_PUBLIC_DIRECTUS_URL/server/health"

# Test Supabase connectivity
curl -s -o /dev/null -w "%{http_code}" "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"

# Stripe CLI — test webhook locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

---

## 10. Cross-References

| Topic | Document |
|-------|----------|
| Architecture & all 24 environment variables | [01 — Architecture Overview](./01-Architecture-Overview.md) |
| Database schema (Supabase tables) | [02 — Database Schema](./02-Database-Schema.md) |
| Directus CMS collections and schema | [03 — Directus CMS Integration](./03-Directus-CMS-Integration.md) |
| Payment system (Stripe & PayPal integration) | [06 — Payment & Subscription System](./06-Payment-Subscription-System.md) |
| Image pipeline (Supabase Storage + CDN) | [07 — Image Pipeline](./07-Image-Pipeline.md) |
| SEO & metadata | [18 — SEO & Metadata](./18-SEO-Metadata.md) |

---
id: "01-Architecture-Overview"
slug: "/01-Architecture-Overview"
sidebar_position: 1
sidebar_label: "Architecture Overview"
---

# 01 - Architecture Overview

> Genesis Studio Platform Architecture Documentation
>
> Last updated: March 2026

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Architectural Patterns](#3-architectural-patterns)
4. [Project Directory Structure](#4-project-directory-structure)
5. [Environment Configuration](#5-environment-configuration)
6. [Security Model](#6-security-model)
7. [Deployment](#7-deployment)
8. [Cross-References](#8-cross-references)

---

## 1. System Architecture

### High-Level System Diagram

```
                              +---------------------+
                              |      Browser         |
                              | (React 19 + TanStack |
                              |   Query + Tailwind)  |
                              +----------+----------+
                                         |
                                   HTTPS Requests
                                         |
                              +----------v----------+
                              |       Vercel         |
                              |   (Next.js 16.1.1)   |
                              |                      |
                              |  +----------------+  |
                              |  | App Router     |  |
                              |  | - RSC Pages    |  |
                              |  | - API Routes   |  |
                              |  |   (/api/*)     |  |
                              |  +-------+--------+  |
                              +----------|----------+
                                         |
                  +----------------------+----------------------+
                  |                      |                      |
         +--------v--------+   +--------v--------+   +---------v--------+
         |    Supabase      |   |    Directus     |   |   Payment APIs   |
         |                  |   |     CMS         |   |                  |
         | - Auth (OAuth)   |   | edit.genesis    |   | - Stripe         |
         | - PostgreSQL DB  |   |  studio.com     |   | - PayPal         |
         | - Storage        |   |                 |   |                  |
         | - Realtime       |   | - REST API      |   | - Webhooks       |
         +--------+---------+   | - Static Token  |   +------------------+
                  |             +---------+-------+
                  |                       |
                  |              +--------v--------+
                  |              |   Cloudflare    |
                  +--------------+   CDN           |
                                 |                 |
                                 | - Image AVIF/   |
                                 |   WebP xforms   |
                                 | - Edge caching  |
                                 +-----------------+
```

### Request Flow

1. **Browser** sends an HTTPS request to the Vercel-hosted Next.js application.
2. **Middleware** (`proxy.ts`) intercepts every request to refresh Supabase auth sessions and apply CORS headers to `/api/*` routes.
3. **Server Components** (page.tsx files) render on the server with metadata and pass data to client components.
4. **Client Components** (*Client.tsx files) hydrate and use TanStack React Query hooks to fetch data from internal `/api/*` route handlers.
5. **API Route Handlers** proxy requests to external services (Directus, Supabase, Stripe, PayPal) using server-side secrets. No external API tokens are exposed to the client.
6. **Directus CMS** serves content data (novels, chapters, banners, etc.) via its REST API using a static token.
7. **Supabase** handles authentication (Google/Discord OAuth), PostgreSQL database operations (wallets, purchases, user data), and file storage.
8. **Stripe/PayPal** process payment transactions. Webhook endpoints receive async payment confirmations.
9. **Cloudflare** transforms and caches images served from Supabase Storage, converting to AVIF/WebP formats with responsive sizing.

---

## 2. Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.1.1 | Full-stack React framework with App Router and Turbopack |
| **React** | 19.1.0 | UI library with Server Components support |
| **Tailwind CSS** | 4 | Utility-first CSS framework (via `@tailwindcss/postcss`) |
| **shadcn/ui** | New York style | RSC-enabled component library built on Radix UI |
| **Radix UI** | Various | Accessible UI primitives (`@radix-ui/react-dropdown-menu`, `@radix-ui/react-slot`, `@radix-ui/react-dialog`) |
| **Framer Motion** | 12 | Animation library (lazy-loaded via `LazyMotionWrapper` component) |
| **Swiper** | 12 | Touch slider/carousel component |
| **Phosphor Icons** | Latest | Primary icon library |
| **Lucide React** | Latest | Secondary icon library (used by shadcn/ui) |
| **React Icons** | Latest | Supplementary icons |
| **TanStack React Query** | 5 | Server state management with caching |
| **react-markdown** | 10.1.0 | Markdown rendering for content pages |
| **marked** | 16.3.0 | Markdown parsing (server-side) |
| **node-vibrant** | 4.0.3 | Color palette extraction from images |
| **class-variance-authority** | Latest | Variant-based component styling (shadcn/ui) |
| **clsx** / **tailwind-merge** | Latest | Conditional class merging utilities |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Next.js API Routes** | 16.1.1 | Route Handlers in `/api/*` acting as API gateway |
| **Supabase** | Latest | Auth (Google/Discord OAuth), PostgreSQL database, Storage |
| **@supabase/ssr** | Latest | Server-side auth session management |
| **@supabase/supabase-js** | Latest | Supabase client SDK |
| **Directus CMS** | Latest | Content management system at `edit.genesistudio.com` |
| **@directus/sdk** | 20.1.0 | Directus SDK with `staticToken` + `rest` transport |
| **Stripe** | 18.5.0 (server) / 7.9.0 (client) | Payment processing (`stripe` / `@stripe/stripe-js`) |
| **PayPal** | REST API | Alternative payment processing |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Vercel** | Hosting, auto-deploy from GitHub, analytics (`@vercel/analytics`), speed insights (`@vercel/speed-insights`) |
| **Cloudflare** | CDN, image transforms (AVIF/WebP conversion), edge caching |
| **Supabase Storage** | File hosting in `"directus"` bucket for all CMS-uploaded media |
| **GitHub** | Source control, CI/CD trigger |

### Developer & Security Tools

| Technology | Version | Purpose |
|---|---|---|
| **TypeScript** | 5 | Static type checking across the entire codebase |
| **Turbopack** | Built-in | Fast bundler for development and production builds |
| **javascript-obfuscator** | 4.1.1 | Production code obfuscation for content protection |
| **disable-devtool** | 0.3.9 | Browser devtool detection and blocking |
| **ESLint** | Latest | Code linting (Next.js config) |

---

## 3. Architectural Patterns

### 3.1 API Gateway Pattern

All external service communication is proxied through Next.js API Route Handlers under `/api/*`. This is the most critical architectural decision in the platform.

```
Browser (Client Component)
    |
    |  fetch('/api/novels')          ← Internal route, no secrets exposed
    |
    v
Next.js Route Handler (/api/novels/route.ts)
    |
    |  directusServer.request(...)   ← Server-side Directus SDK with DIRECTUS_TOKEN
    |
    v
Directus CMS (edit.genesistudio.com)
```

**Key principles:**
- Server-side secrets (`DIRECTUS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_SECRET`) are **never** included in client bundles.
- Client components call only internal `/api/*` endpoints.
- API route handlers perform all external service calls with server tokens.
- The `lib/api-utils.ts` module provides shared utilities for consistent error handling and response formatting across all 46+ API routes.

### 3.2 Client-Server Component Separation

Every page follows a consistent two-file pattern:

```
src/app/novels/[abbreviation]/
  ├── page.tsx              ← Server Component (metadata, SEO, initial data)
  └── NovelDetailClient.tsx ← Client Component ("use client", interactivity)
```

- **`page.tsx`** — Server Component responsible for:
  - Generating dynamic metadata (title, description, OpenGraph)
  - Fetching initial server-side data when needed
  - Rendering the client component wrapper

- **`*Client.tsx`** — Client Component responsible for:
  - All user interactivity and state management
  - TanStack React Query data fetching hooks
  - Event handlers, modals, animations

**Exception:** The chapter viewer (`/viewer/[id]`) is a fully client-side page with no Navbar or Footer, providing an immersive reading experience.

### 3.3 CDN Image Pipeline

A three-service pipeline handles all images:

```
Directus CMS                Supabase Storage              Cloudflare CDN
(file metadata/UUID)  →     (file hosting in             →  (image transforms
                             "directus" bucket)              to AVIF/WebP)

edit.genesistudio.com       ckiwecspopkpvhccpisf          genesistudio.com
/assets/{uuid}              .supabase.co/storage           /cdn-cgi/image/
                            /v1/object/public/              format=auto,
                            directus/{filename}             width=X/{url}
```

1. **Directus** manages file metadata (title, tags, dimensions) and stores UUIDs.
2. **Supabase Storage** hosts the actual files in a `"directus"` bucket.
3. **Cloudflare** transforms images on-the-fly, converting to AVIF/WebP and resizing based on query parameters.
4. The `NEXT_PUBLIC_ENABLE_IMAGE_TRANSFORMS` flag controls whether Cloudflare transforms are active.

> See [07 — Image Pipeline](./07-Image-Pipeline.md) for complete implementation details.

### 3.4 Unified Payment Modal System

The `ModalViewboxContext` manages a stack-based modal system for all payment and purchase flows.

```
ModalViewboxContext
    ├── novel-subscription    → Subscribe to a novel (Stripe/PayPal)
    ├── helix-unlock          → Unlock a chapter with Helix currency
    ├── helix-purchase        → Buy Helix packs (Stripe/PayPal)
    ├── unlock-options        → Choose between subscription or Helix unlock
    └── insufficient-helix   → Prompt to buy more Helix when balance is low
```

**Modal stack behavior:**
- Modals can be pushed onto a stack (e.g., `unlock-options` → `insufficient-helix` → `helix-purchase`).
- Closing a modal pops back to the previous modal in the stack.
- Payment completion closes the entire stack.

### 3.5 React Query Data Layer

All CMS and API data is fetched via dedicated React Query hooks in `src/hooks/queries/`.

```
src/hooks/queries/
    ├── useNovelQuery.ts            → Single novel data
    ├── useNovelsQuery.ts           → Novel listings
    ├── useChapterQuery.ts          → Chapter content
    ├── useBannersQuery.ts          → Homepage banners
    ├── useShowcaseQuery.ts         → Showcase data
    └── ... (additional query hooks)
```

**Default caching configuration:**
- `staleTime`: 5 minutes — data considered fresh for 5 minutes before refetching
- `gcTime`: 30 minutes — unused data garbage collected after 30 minutes
- Query keys are structured hierarchically for targeted invalidation

> See [08 — State Management](./08-State-Management.md) for query hook details and caching strategies.

### 3.6 Reader Discussion Subsystem

Reader discussion is implemented as a dedicated comments subsystem that lives directly inside the chapter viewer.

- `src/app/viewer/[chapterId]/page.tsx` mounts `CommentDrawer`
- `src/hooks/queries/useComments.ts` handles fetching, polling, and mutation flows
- `/api/comments/*` route handlers own create/edit/delete/vote/reply/report behavior
- Supabase stores comment bodies, votes, and reports
- Directus `user_profiles` enriches author display metadata

This keeps discussion close to the reading experience while preserving the platform's API-gateway pattern and server-side secret isolation.

---

## 4. Project Directory Structure

```
genesis-site/
├── src/
│   ├── app/
│   │   ├── api/                          # 46+ API route handlers
│   │   │   ├── novels/                   #   Novel CRUD and listings
│   │   │   ├── chapters/                 #   Chapter content and metadata
│   │   │   ├── auth/                     #   Auth callbacks and session
│   │   │   ├── stripe/                   #   Stripe checkout, webhooks, portal
│   │   │   ├── paypal/                   #   PayPal orders, subscriptions, webhooks
│   │   │   ├── payments/                 #   Unified payment operations
│   │   │   ├── wallets/                  #   Helix wallet operations
│   │   │   ├── user/                     #   User profile, preferences, metrics
│   │   │   ├── bookmarks/               #   Bookmark CRUD
│   │   │   ├── comments/                #   Comment CRUD, upvotes, reports
│   │   │   ├── singularities/           #   Singularity placement
│   │   │   ├── banners/                 #   Homepage banner data
│   │   │   ├── showcases/               #   Showcase data
│   │   │   ├── announcements/           #   Announcement content
│   │   │   ├── leaderboards/            #   Various leaderboard data
│   │   │   └── .../                     #   Additional route handlers
│   │   │
│   │   ├── components/                   # Feature-specific components
│   │   │   ├── auth/                     #   Login modals, OAuth buttons
│   │   │   ├── common/                   #   Navbar, Footer, DevtoolProtection,
│   │   │   │                             #   NoRightClick, ScrollToTop
│   │   │   ├── homepage/                 #   Hero, banners, showcases, carousels
│   │   │   ├── novel-detail/             #   Novel info, chapter lists, tabs
│   │   │   ├── novels/                   #   Novel cards, grids, filters
│   │   │   ├── payment/                  #   Payment modals, Helix purchase UI
│   │   │   ├── profile/                  #   User profile components
│   │   │   ├── skeletons/                #   Loading skeleton components
│   │   │   └── store/                    #   Store page components
│   │   │
│   │   ├── context/                      # React Context providers
│   │   │   ├── AuthContext.tsx            #   Auth state, user session
│   │   │   ├── ToastContext.tsx           #   Toast notifications
│   │   │   └── ModalViewboxContext.tsx    #   Payment modal stack management
│   │   │
│   │   ├── (route directories)/          # Page routes (App Router)
│   │   │   ├── page.tsx                  #   Server component (metadata)
│   │   │   └── *Client.tsx               #   Client component (interactivity)
│   │   │
│   │   ├── globals.css                   # 1161 lines - Tailwind config, themes,
│   │   │                                 #   dark/light mode, custom CSS, animations
│   │   └── layout.tsx                    # Root layout with all providers
│   │
│   ├── components/                       # Shared/reusable components
│   │   ├── ui/                           #   shadcn/ui components (Button, Dialog,
│   │   │                                 #   DropdownMenu, Card, Input, etc.)
│   │   ├── motion/                       #   LazyMotionWrapper (Framer Motion)
│   │   ├── payment/                      #   CheckoutForm (Stripe Elements)
│   │   └── MarkdownRenderer.tsx          #   Shared markdown rendering
│   │
│   ├── hooks/                            # Custom React hooks
│   │   ├── queries/                      #   TanStack React Query hooks
│   │   │   ├── useNovelQuery.ts          #     Novel data queries
│   │   │   ├── useChapterQuery.ts        #     Chapter data queries
│   │   │   └── .../                      #     Additional query hooks
│   │   └── (other hooks)                 #   useMediaQuery, useDebounce, etc.
│   │
│   ├── lib/                              # Shared libraries and utilities
│   │   ├── supabase.ts                   #   Browser Supabase client
│   │   ├── supabase-server.ts            #   Server Supabase client (SSR)
│   │   ├── directus.ts                   #   Browser Directus client (public)
│   │   ├── directus-server.ts            #   Server Directus client (with token)
│   │   ├── stripe.ts                     #   Stripe client initialization
│   │   ├── queryClient.ts                #   TanStack Query client config
│   │   ├── api-utils.ts                  #   API route shared utilities
│   │   ├── auth-utils.ts                 #   Auth helper functions
│   │   ├── utils.ts                      #   General utility functions (cn, etc.)
│   │   ├── novelCache.ts                 #   Novel data caching layer
│   │   ├── analytics.ts                  #   Analytics event tracking
│   │   └── environment-utils.ts          #   Env var validation and access
│   │
│   ├── providers/                        # React provider components
│   │   └── QueryProvider.tsx             #   TanStack React Query provider
│   │
│   ├── proxy.ts                          # Next.js Middleware
│   │                                     #   - Supabase session refresh
│   │                                     #   - CORS headers on /api/* routes
│   │
│   └── types/                            # TypeScript type definitions
│       ├── novel.ts                      #   Novel, Chapter, Genre interfaces
│       ├── payment.ts                    #   Payment, Wallet, Pack types
│       ├── singularity.ts                #   Singularity types
│       ├── catalogue-spread.ts           #   Catalogue layout types
│       ├── cms-banners.ts                #   Banner types
│       ├── color-palette.ts              #   Color palette types
│       ├── genre-section.ts              #   Genre section types
│       ├── release-days.ts               #   Release schedule types
│       └── showcase.ts                   #   Showcase types
│
├── scripts/                              # Utility scripts (11 total)
│   ├── stripe-cleanup.ts                 #   Clean up Stripe test data
│   ├── paypal-provisioning.ts            #   Provision PayPal plans/products
│   ├── dev-setup.ts                      #   Development environment setup
│   └── .../                              #   Additional maintenance scripts
│
├── public/                               # Static assets
│   ├── favicons/                         #   Favicon variants
│   ├── social-icons/                     #   Social media icons
│   ├── app-icons/                        #   PWA/app icons
│   └── logos/                            #   Brand logos
│
├── docs/                                 # Developer documentation (this folder)
│
├── misc/                                 # Legacy references
│   └── directus_data_model/              #   Directus schema exports
│
├── next.config.ts                        # Next.js configuration
├── tailwind.config.ts                    # Tailwind CSS configuration
├── tsconfig.json                         # TypeScript configuration
├── package.json                          # Dependencies and scripts
└── .env.local                            # Environment variables (not committed)
```

---

## 5. Environment Configuration

All environment variables are defined in `.env.local` (local development) and configured in the Vercel project settings for production.

### Supabase

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Supabase service role key (full DB access, bypasses RLS) |
| `NEXT_PUBLIC_SUPABASE_API` | Client + Server | Supabase REST API base URL |
| `NEXT_PUBLIC_SUPABASE_STORAGE_API` | Client + Server | Supabase Storage API base URL |

### Directus CMS

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_DIRECTUS_API` | Client + Server | Directus API URL (`https://edit.genesistudio.com`) |
| `DIRECTUS_TOKEN` | **Server only** | Directus static token for authenticated API access |

### Stripe (Live)

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client + Server | Stripe live publishable key |
| `STRIPE_SECRET_KEY` | **Server only** | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | **Server only** | Stripe live webhook signing secret |
| `STRIPE_ENV` | Server | Stripe environment flag (`live` or `dev`) |

### Stripe (Development)

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_DEV` | Client + Server | Stripe test publishable key |
| `STRIPE_SECRET_KEY_DEV` | **Server only** | Stripe test secret key |
| `STRIPE_WEBHOOK_SECRET_DEV` | **Server only** | Stripe test webhook signing secret |

### PayPal (Live)

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Client + Server | PayPal live client ID |
| `PAYPAL_CLIENT_SECRET` | **Server only** | PayPal live client secret |
| `PAYPAL_WEBHOOK_ID` | **Server only** | PayPal live webhook ID |
| `PAYPAL_ENV` | Server | PayPal environment flag (`live` or `dev`) |

### PayPal (Development)

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID_DEV` | Client + Server | PayPal sandbox client ID |
| `PAYPAL_CLIENT_SECRET_DEV` | **Server only** | PayPal sandbox client secret |
| `PAYPAL_WEBHOOK_ID_DEV` | **Server only** | PayPal sandbox webhook ID |

### Site Configuration

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_BASE_SITE_URL` | Client + Server | Base site URL (e.g., `https://genesistudio.com`) |
| `NEXT_PUBLIC_ENABLE_IMAGE_TRANSFORMS` | Client + Server | Enable/disable Cloudflare image transforms (`true`/`false`) |

### Security Notes

- Variables prefixed with `NEXT_PUBLIC_` are embedded in client-side JavaScript bundles and are visible to users. They must only contain public/publishable keys.
- Variables **without** the `NEXT_PUBLIC_` prefix are available only in server-side code (API routes, server components, middleware). They are never included in client bundles.
- The `STRIPE_ENV` and `PAYPAL_ENV` flags allow switching between live and development payment credentials without changing the key variables. The application reads the appropriate key set based on these flags.

---

## 6. Security Model

### 6.1 Server-Side Secret Isolation

The most critical security boundary is the separation of server-only secrets from client-accessible code:

| Secret | Used In | Never Appears In |
|---|---|---|
| `DIRECTUS_TOKEN` | `lib/directus-server.ts`, API routes | Client components, browser bundles |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase-server.ts`, API routes | Client components, browser bundles |
| `STRIPE_SECRET_KEY` / `_DEV` | API routes (`/api/stripe/*`) | Client components, browser bundles |
| `PAYPAL_CLIENT_SECRET` / `_DEV` | API routes (`/api/paypal/*`) | Client components, browser bundles |
| `STRIPE_WEBHOOK_SECRET` / `_DEV` | Webhook route handlers | Client components, browser bundles |

The `lib/directus-server.ts` and `lib/supabase-server.ts` modules are exclusively imported in server-side code. Next.js tree-shaking ensures these modules and their secrets are excluded from client bundles.

### 6.2 CORS Middleware

The middleware in `proxy.ts` adds CORS headers to all `/api/*` routes:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

This allows the frontend to call API routes from the same origin while also supporting potential future cross-origin integrations.

### 6.3 Content Protection

Multiple layers protect premium chapter content from unauthorized copying:

| Layer | Implementation | Purpose |
|---|---|---|
| **DevTool Detection** | `disable-devtool` (v0.3.9) via `DevtoolProtection` component | Detects and blocks browser developer tools |
| **Right-Click Prevention** | `NoRightClick` wrapper component | Prevents context menu on protected pages |
| **Code Obfuscation** | `javascript-obfuscator` (v4.1.1) in production builds | Makes client-side code harder to reverse-engineer |
| **Content Watermarking** | Embedded in chapter content for paid chapters | Traces unauthorized content distribution |

### 6.4 AI Crawler Blocking

The `robots.ts` file (Next.js metadata API) blocks known AI training crawlers:

```
Blocked User Agents:
- GPTBot (OpenAI)
- CCBot (Common Crawl)
- anthropic-ai (Anthropic)
- Google-Extended (Google AI)
- (additional AI crawlers)
```

### 6.5 Authentication Security

- Authentication is handled by Supabase Auth with OAuth providers (Google, Discord).
- `@supabase/ssr` manages auth sessions via HTTP-only cookies.
- The middleware in `proxy.ts` refreshes auth sessions on every request.
- Server-side route handlers verify user sessions before performing authenticated operations.
- The `SUPABASE_SERVICE_ROLE_KEY` is used only in server-side code for administrative operations that bypass Row Level Security (RLS).

---

## 7. Deployment

### Hosting and CI/CD

- **Platform:** Vercel
- **Deployment trigger:** Automatic deployment on push to the main branch on GitHub.
- **Build tool:** Turbopack (used for both `next dev` and `next build`)
- **Preview deployments:** Vercel creates preview deployments for pull requests.

### Build Configuration

The `next.config.ts` file configures:

- **Image domains:** Allowed remote image sources for `next/image`:
  - `edit.genesistudio.com` — Directus CMS assets
  - `ckiwecspopkpvhccpisf.supabase.co` — Supabase Storage
  - `api.genesistudio.com` — API-served images
  - `genesistudio.com/cdn-cgi` — Cloudflare CDN image transforms

- **Turbopack:** Enabled for both development and production builds for faster compilation.

- **Vercel integrations:**
  - `@vercel/analytics` — Web analytics tracking
  - `@vercel/speed-insights` — Core Web Vitals monitoring

### Production Checklist

| Item | Details |
|---|---|
| Environment variables | All 24 env vars configured in Vercel project settings |
| Stripe webhooks | Live webhook endpoint configured to `{BASE_URL}/api/stripe/webhook` |
| PayPal webhooks | Live webhook endpoint configured to `{BASE_URL}/api/paypal/webhook` |
| Supabase OAuth | Google and Discord OAuth redirect URLs set to production domain |
| Cloudflare | DNS and CDN configured, image transforms enabled |
| Domain | `genesistudio.com` pointed to Vercel |

---

## 8. Cross-References

| Document | Covers |
|---|---|
| [02-Database-Schema.md](./02-Database-Schema.md) | Complete database schema, all tables, relationships, and ER diagram |
| [05-Authentication-System.md](./05-Authentication-System.md) | Supabase Auth setup, OAuth providers, session management, middleware |
| [04-API-Reference.md](./04-API-Reference.md) | All API route handlers, request/response formats, and error handling |
| [06-Payment-Subscription-System.md](./06-Payment-Subscription-System.md) | Stripe and PayPal integration, Helix currency, subscriptions, webhooks |
| [03-Directus-CMS-Integration.md](./03-Directus-CMS-Integration.md) | Directus CMS setup, content models, and editorial workflow |
| [07-Image-Pipeline.md](./07-Image-Pipeline.md) | Directus → Supabase Storage → Cloudflare image pipeline |
| [08-State-Management.md](./08-State-Management.md) | TanStack React Query hooks, caching strategy, query keys, and contexts |
| [13-UI-Comments-System.md](./13-UI-Comments-System.md) | Reader discussion architecture, comment APIs, votes, replies, and reports |
| [19-Scripts-Development-Setup.md](./19-Scripts-Development-Setup.md) | Local setup, scripts, debugging, and deployment workflow |
